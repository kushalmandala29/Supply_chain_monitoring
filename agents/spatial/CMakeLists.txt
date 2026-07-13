cmake_minimum_required(VERSION 3.16)
project(spatial_agent CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(PkgConfig REQUIRED)
pkg_check_modules(HIREDIS REQUIRED hiredis)
find_package(yaml-cpp REQUIRED)
find_package(nlohmann_json REQUIRED)

add_executable(spatial_agent src/main.cpp)

target_include_directories(spatial_agent PRIVATE ${HIREDIS_INCLUDE_DIRS})
target_link_libraries(spatial_agent PRIVATE ${HIREDIS_LIBRARIES} yaml-cpp nlohmann_json::nlohmann_json)
