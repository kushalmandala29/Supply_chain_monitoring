// Spatial Agent: geofencing, polygon generation, spatial overlap analysis,
// and distance calculations over the supply-chain graph's coordinates --
// plus KPI-weighted operational risk scoring (compounds weather risk,
// geography risk, and KPI health into one score per entity).
//
// This implements the same event-driven contract as the Python agents
// (consume query.received via a Redis Streams consumer group, act only on
// queries routed to "spatial", publish a result) using hiredis + yaml-cpp +
// nlohmann::json directly, since the spatial workload benefits from native
// performance (PRD section 8: Spatial Agent (C++)).
//
// The actual geofencing / ST_* style geometry work is not implemented yet --
// that will call into PostGIS and/or a C++ geometry library (e.g. GEOS) once
// the Knowledge Layer schema (section 9) is in place. Real geometry and
// real weather-ETL data are both still stubs, so this agent's weather and
// geography risk components use a neutral 0.5 placeholder until those exist
// (see kNeutralComponentScore below) -- everything else (fill_rate,
// inventory_accuracy, picking_accuracy) is real, sourced from the
// kpi.update stream that backend/app/services/kpi/websocket_publisher.py
// publishes on every KPI recompute (PostgreSQL remains the source of truth;
// this agent only reads the ambient Redis broadcast, never Postgres
// directly, since hiredis is this agent's one existing dependency).

#include <hiredis/hiredis.h>
#include <yaml-cpp/yaml.h>
#include <nlohmann/json.hpp>

#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <iostream>
#include <map>
#include <string>
#include <thread>
#include <vector>

using json = nlohmann::json;

namespace {

constexpr const char* kAgentName = "spatial";
constexpr const char* kOutputStreamKey = "risk_detected";  // spatial overlap analysis feeds risk zones
constexpr double kNeutralComponentScore = 0.5;  // weather/geography placeholder until those pipelines are real
constexpr int kKpiUpdateLookback = 100;         // how many recent kpi.update messages to scan per query

struct RedisEndpoint {
    std::string host = "localhost";
    int port = 6379;
};

RedisEndpoint parse_redis_url(const std::string& url) {
    RedisEndpoint endpoint;
    auto scheme_pos = url.find("://");
    std::string rest = scheme_pos == std::string::npos ? url : url.substr(scheme_pos + 3);
    auto at_pos = rest.find('@');
    if (at_pos != std::string::npos) rest = rest.substr(at_pos + 1);
    auto slash_pos = rest.find('/');
    std::string host_port = slash_pos == std::string::npos ? rest : rest.substr(0, slash_pos);
    auto colon_pos = host_port.find(':');
    if (colon_pos != std::string::npos) {
        endpoint.host = host_port.substr(0, colon_pos);
        endpoint.port = std::stoi(host_port.substr(colon_pos + 1));
    } else if (!host_port.empty()) {
        endpoint.host = host_port;
    }
    return endpoint;
}

YAML::Node load_yaml_root() {
    for (const char* candidate : {"/config/settings.yaml", "../../config/settings.yaml"}) {
        try {
            return YAML::LoadFile(candidate);
        } catch (const YAML::BadFile&) {
            continue;
        }
    }
    std::cerr << "[SPATIAL] warning: could not load config/settings.yaml, using defaults\n";
    return YAML::Node();
}

std::map<std::string, std::string> load_stream_names(const YAML::Node& root) {
    std::map<std::string, std::string> streams;
    if (root["redis_streams"]) {
        for (const auto& entry : root["redis_streams"]) {
            streams[entry.first.as<std::string>()] = entry.second.as<std::string>();
        }
    }
    if (streams.empty()) {
        streams = {
            {"query_received", "query.received"},
            {"risk_detected", "risk.detected"},
            {"kpi_update", "kpi.update"},
            {"consumer_group", "agents"},
        };
    }
    return streams;
}

std::map<std::string, double> load_risk_thresholds(const YAML::Node& root) {
    std::map<std::string, double> thresholds = {{"high", 0.85}, {"medium", 0.60}, {"low", 0.0}};
    if (root["risk_thresholds"]) {
        for (const auto& entry : root["risk_thresholds"]) {
            thresholds[entry.first.as<std::string>()] = entry.second.as<double>();
        }
    }
    return thresholds;
}

std::map<std::string, double> load_risk_weights(const YAML::Node& root) {
    std::map<std::string, double> weights = {
        {"weather", 0.2}, {"geography", 0.2}, {"fill_rate", 0.2},
        {"inventory_accuracy", 0.2}, {"picking_accuracy", 0.2},
    };
    if (root["spatial"] && root["spatial"]["risk_weights"]) {
        for (const auto& entry : root["spatial"]["risk_weights"]) {
            weights[entry.first.as<std::string>()] = entry.second.as<double>();
        }
    }
    return weights;
}

std::string classify_severity(double score, const std::map<std::string, double>& thresholds) {
    if (score >= thresholds.at("high")) return "high";
    if (score >= thresholds.at("medium")) return "medium";
    return "low";
}

std::string getenv_or(const char* name, const std::string& fallback) {
    const char* value = std::getenv(name);
    return value ? std::string(value) : fallback;
}

// XREVRANGE the given stream for its `count` most recent messages, parsing
// each one's "data" field as JSON. Mirrors StreamBus.read_recent() on the
// Python side -- read-only, no consumer group, doesn't compete with
// whichever service is actually responsible for consuming the stream.
std::vector<json> xrevrange_recent(redisContext* ctx, const std::string& stream, int count) {
    std::vector<json> results;
    redisReply* reply = static_cast<redisReply*>(
        redisCommand(ctx, "XREVRANGE %s + - COUNT %d", stream.c_str(), count));
    if (reply == nullptr || reply->type != REDIS_REPLY_ARRAY) {
        if (reply) freeReplyObject(reply);
        return results;
    }
    for (size_t i = 0; i < reply->elements; ++i) {
        redisReply* entry = reply->element[i];
        if (entry->elements < 2) continue;
        redisReply* fields = entry->element[1];
        std::string data_json = "{}";
        for (size_t f = 0; f + 1 < fields->elements; f += 2) {
            if (std::string(fields->element[f]->str) == "data") {
                data_json = fields->element[f + 1]->str;
            }
        }
        json payload = json::parse(data_json, nullptr, false);
        if (!payload.is_discarded()) results.push_back(payload);
    }
    freeReplyObject(reply);
    return results;
}

// Component score in [0, 1] where 1.0 = worst. fill_rate/inventory_accuracy/
// picking_accuracy are all "higher is healthier" percentages (0-100), so the
// risk contribution is simply the inverted, clamped fraction.
double kpi_component_risk(double kpi_value) {
    double risk = (100.0 - kpi_value) / 100.0;
    return std::clamp(risk, 0.0, 1.0);
}

// Builds { entity_id -> { kpi_name -> latest kpi_value } } from recent
// kpi.update broadcasts (ambient, ordered by ascending recency since we
// only keep the first value seen per (entity_id, kpi_name) pair scanning
// most-recent-first).
std::map<std::string, std::map<std::string, double>> latest_kpis_by_entity(
    const std::vector<json>& kpi_updates) {
    std::map<std::string, std::map<std::string, double>> by_entity;
    for (const auto& payload : kpi_updates) {
        if (!payload.contains("entity_id") || !payload.contains("kpi_name") || !payload.contains("kpi_value")) {
            continue;
        }
        std::string entity_id = payload["entity_id"].get<std::string>();
        std::string kpi_name = payload["kpi_name"].get<std::string>();
        auto& entity_kpis = by_entity[entity_id];
        if (entity_kpis.find(kpi_name) == entity_kpis.end()) {
            entity_kpis[kpi_name] = payload["kpi_value"].get<double>();
        }
    }
    return by_entity;
}

// Combines weather risk + geography risk + fill_rate + inventory_accuracy +
// picking_accuracy into one compounded operational risk score per entity,
// weighted by config/settings.yaml's spatial.risk_weights, renormalized
// over whichever components are actually present for that entity.
json compute_operational_risk(
    const std::map<std::string, std::map<std::string, double>>& kpis_by_entity,
    const std::map<std::string, double>& weights,
    const std::map<std::string, double>& thresholds) {
    json entities = json::array();

    for (const auto& [entity_id, kpis] : kpis_by_entity) {
        double weighted_sum = 0.0;
        double weight_total = 0.0;
        json components = json::object();

        // weather/geography: neutral placeholder until the weather ETL /
        // PostGIS geometry pipelines produce real per-entity scores.
        for (const char* placeholder_component : {"weather", "geography"}) {
            double w = weights.count(placeholder_component) ? weights.at(placeholder_component) : 0.0;
            weighted_sum += w * kNeutralComponentScore;
            weight_total += w;
            components[placeholder_component] = kNeutralComponentScore;
        }

        for (const char* kpi_component : {"fill_rate", "inventory_accuracy", "picking_accuracy"}) {
            auto it = kpis.find(kpi_component);
            if (it == kpis.end()) continue;
            double w = weights.count(kpi_component) ? weights.at(kpi_component) : 0.0;
            double risk = kpi_component_risk(it->second);
            weighted_sum += w * risk;
            weight_total += w;
            components[kpi_component] = it->second;
        }

        if (weight_total == 0.0) continue;
        double compounded_risk = weighted_sum / weight_total;

        entities.push_back({
            {"entity_id", entity_id},
            {"compounded_risk", compounded_risk},
            {"severity", classify_severity(compounded_risk, thresholds)},
            {"components", components},
        });
    }
    return entities;
}

}  // namespace

int main() {
    const YAML::Node config_root = load_yaml_root();
    const auto streams = load_stream_names(config_root);
    const auto risk_thresholds = load_risk_thresholds(config_root);
    const auto risk_weights = load_risk_weights(config_root);

    const std::string query_stream = streams.at("query_received");
    const std::string output_stream = streams.count(kOutputStreamKey)
                                           ? streams.at(kOutputStreamKey)
                                           : "risk.detected";
    const std::string kpi_update_stream = streams.count("kpi_update") ? streams.at("kpi_update") : "kpi.update";
    const std::string group_prefix = streams.count("consumer_group") ? streams.at("consumer_group") : "agents";
    const std::string group = group_prefix + "." + kAgentName;

    const auto endpoint = parse_redis_url(getenv_or("REDIS_URL", "redis://localhost:6379/0"));

    redisContext* ctx = redisConnect(endpoint.host.c_str(), endpoint.port);
    if (ctx == nullptr || ctx->err) {
        std::cerr << "[SPATIAL] failed to connect to redis: "
                  << (ctx ? ctx->errstr : "allocation failed") << "\n";
        return 1;
    }

    {
        redisReply* reply = static_cast<redisReply*>(redisCommand(
            ctx, "XGROUP CREATE %s %s 0 MKSTREAM", query_stream.c_str(), group.c_str()));
        if (reply && reply->type == REDIS_REPLY_ERROR &&
            std::string(reply->str).find("BUSYGROUP") == std::string::npos) {
            std::cerr << "[SPATIAL] XGROUP CREATE error: " << reply->str << "\n";
        }
        if (reply) freeReplyObject(reply);
    }

    std::cout << "[SPATIAL] listening on " << query_stream << "\n";

    while (true) {
        redisReply* reply = static_cast<redisReply*>(redisCommand(
            ctx, "XREADGROUP GROUP %s %s COUNT 10 BLOCK 5000 STREAMS %s >",
            group.c_str(), kAgentName, query_stream.c_str()));

        if (reply == nullptr) {
            std::cerr << "[SPATIAL] lost connection to redis, retrying...\n";
            std::this_thread::sleep_for(std::chrono::seconds(2));
            continue;
        }
        if (reply->type != REDIS_REPLY_ARRAY) {
            freeReplyObject(reply);
            continue;
        }

        // reply -> [ [stream_name, [ [id, [field, value, ...]], ... ]] ]
        for (size_t s = 0; s < reply->elements; ++s) {
            redisReply* stream_entry = reply->element[s];
            redisReply* messages = stream_entry->element[1];

            for (size_t m = 0; m < messages->elements; ++m) {
                redisReply* message = messages->element[m];
                std::string message_id = message->element[0]->str;
                redisReply* fields = message->element[1];

                std::string data_json = "{}";
                for (size_t f = 0; f + 1 < fields->elements; f += 2) {
                    if (std::string(fields->element[f]->str) == "data") {
                        data_json = fields->element[f + 1]->str;
                    }
                }

                json payload = json::parse(data_json, nullptr, false);
                if (!payload.is_discarded()) {
                    bool addressed_to_spatial = false;
                    if (payload.contains("agents") && payload["agents"].is_array()) {
                        for (const auto& agent : payload["agents"]) {
                            if (agent == kAgentName) addressed_to_spatial = true;
                        }
                    }

                    if (addressed_to_spatial) {
                        std::string query = payload.value("query", "");
                        std::cout << "[SPATIAL] handling query: " << query << "\n";

                        // TODO: real geofencing / ST_Contains / ST_Intersects /
                        // ST_Distance work against PostGIS goes here.
                        const auto kpi_updates = xrevrange_recent(ctx, kpi_update_stream, kKpiUpdateLookback);
                        const auto kpis_by_entity = latest_kpis_by_entity(kpi_updates);
                        json operational_risk = compute_operational_risk(kpis_by_entity, risk_weights, risk_thresholds);

                        json result = {
                            {"session_id", payload.value("session_id", "")},
                            {"query", query},
                            {"geofences", json::array()},
                            {"operational_risk", operational_risk},
                            {"note", operational_risk.empty()
                                         ? "No kpi.update data observed yet for: " + query
                                         : nullptr},
                        };

                        redisReply* xadd_reply = static_cast<redisReply*>(redisCommand(
                            ctx, "XADD %s * data %s", output_stream.c_str(), result.dump().c_str()));
                        if (xadd_reply) freeReplyObject(xadd_reply);
                    }
                }

                redisReply* xack_reply = static_cast<redisReply*>(redisCommand(
                    ctx, "XACK %s %s %s", query_stream.c_str(), group.c_str(), message_id.c_str()));
                if (xack_reply) freeReplyObject(xack_reply);
            }
        }

        freeReplyObject(reply);
    }

    redisFree(ctx);
    return 0;
}
