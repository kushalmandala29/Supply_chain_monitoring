// Spatial Agent: geofencing, polygon generation, spatial overlap analysis,
// and distance calculations over the supply-chain graph's coordinates.
//
// This is a skeleton: it implements the same event-driven contract as the
// Python agents (consume query.received via a Redis Streams consumer group,
// act only on queries routed to "spatial", publish a result) using hiredis +
// yaml-cpp + nlohmann::json directly, since the spatial workload benefits
// from native performance (PRD section 8: Spatial Agent (C++)).
//
// The actual geofencing / ST_* style geometry work is not implemented yet --
// that will call into PostGIS and/or a C++ geometry library (e.g. GEOS) once
// the Knowledge Layer schema (section 9) is in place.

#include <hiredis/hiredis.h>
#include <yaml-cpp/yaml.h>
#include <nlohmann/json.hpp>

#include <chrono>
#include <cstdlib>
#include <iostream>
#include <map>
#include <string>
#include <thread>

using json = nlohmann::json;

namespace {

constexpr const char* kAgentName = "spatial";
constexpr const char* kOutputStreamKey = "risk_detected";  // spatial overlap analysis feeds risk zones

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

std::map<std::string, std::string> load_stream_names() {
    for (const char* candidate : {"/config/settings.yaml", "../../config/settings.yaml"}) {
        try {
            YAML::Node config = YAML::LoadFile(candidate);
            std::map<std::string, std::string> streams;
            for (const auto& entry : config["redis_streams"]) {
                streams[entry.first.as<std::string>()] = entry.second.as<std::string>();
            }
            return streams;
        } catch (const YAML::BadFile&) {
            continue;
        }
    }
    std::cerr << "[SPATIAL] warning: could not load config/settings.yaml, using defaults\n";
    return {
        {"query_received", "query.received"},
        {"risk_detected", "risk.detected"},
        {"consumer_group", "agents"},
    };
}

std::string getenv_or(const char* name, const std::string& fallback) {
    const char* value = std::getenv(name);
    return value ? std::string(value) : fallback;
}

}  // namespace

int main() {
    const auto streams = load_stream_names();
    const std::string query_stream = streams.at("query_received");
    const std::string output_stream = streams.count(kOutputStreamKey)
                                           ? streams.at(kOutputStreamKey)
                                           : "risk.detected";
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
                        json result = {
                            {"session_id", payload.value("session_id", "")},
                            {"query", query},
                            {"geofences", json::array()},
                            {"note", "No geofencing implemented yet for: " + query},
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
