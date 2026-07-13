FROM debian:bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake pkg-config \
    libhiredis-dev libyaml-cpp-dev nlohmann-json3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY agents/spatial .
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    libhiredis-dev libyaml-cpp-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /src/build/spatial_agent /usr/local/bin/spatial_agent

CMD ["spatial_agent"]
