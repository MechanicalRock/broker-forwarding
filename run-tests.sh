#!/bin/bash

MODE=$1
if [ -z $MODE ]; then
    MODE=up
else
    MODE=run
fi

docker-compose -f docker-compose.yml $MODE testing
