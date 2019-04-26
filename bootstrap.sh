#!/bin/bash

echo "Waiting for RABBITMQ to appear"
/wait-for-it.sh -h rabbitmq -p 5672
# get the erlang cookie from the rabbitmq host for authentication. we'll need this for setting stuff up
scp -o StrictHostKeyChecking=no -i /var/lib/rabbitmq/.ssh/id_rsa rabbitmq@rabbitmq:/var/lib/rabbitmq/.erlang.cookie /var/lib/rabbitmq/.erlang.cookie

# get the rabbitmq node name
RABBITMQ_HOST=`rabbitmqadmin -H rabbitmq -f bash list nodes`

# declare a source broker exchange

# declare a source broker consumer queue

# bind the queue to the exchange

# declare a shovel to forward exchange to destination broker

