#!/bin/bash

echo "Waiting for RABBITMQ to appear"
/wait-for-it.sh -h rabbitmq -p 5672
# get the erlang cookie from the rabbitmq host for authentication. we'll need this for setting stuff up
scp -o StrictHostKeyChecking=no -i /var/lib/rabbitmq/.ssh/id_rsa rabbitmq@rabbitmq:/var/lib/rabbitmq/.erlang.cookie /var/lib/rabbitmq/.erlang.cookie

# get the rabbitmq node name
RABBITMQ_HOST=`rabbitmqadmin -H rabbitmq -f bash list nodes`
echo "Rabbit host is $RABBITMQ_HOST"

# declare source broker exchanges
rabbitmqadmin -H rabbitmq declare exchange name=$EXCHANGE_PATTERN_1 type=topic
rabbitmqadmin -H rabbitmq declare exchange name=$EXCHANGE_PATTERN_2 type=topic
rabbitmqadmin -H rabbitmq declare exchange name=$EXCHANGE_PATTERN_3 type=topic

# declare the first queue and bind it to the exchange
Q1="q.${EXCHANGE_PATTERN_1}"
rabbitmqadmin -H rabbitmq declare queue name=$Q1
rabbitmqadmin -H rabbitmq declare binding source=$EXCHANGE_PATTERN_1 destination=$Q1

# declare shovels to forward exchanges to destination broker
rabbitmqctl --node $RABBITMQ_HOST set_parameter shovel "${EXCHANGE_PATTERN_1}-activemq" \
"{'src-protocol': 'amqp091', 'src-uri': 'amqp://guest:guest@rabbitmq:5672', 'src-exchange': \"$EXCHANGE_PATTERN_1\",'src-exchange-key': '#', \
  'dest-protocol': 'amqp10', 'dest-uri': 'amqp://admin:admin@activemq:5672', 'dest-address': \"$EXCHANGE_PATTERN_1\"}"

rabbitmqctl --node $RABBITMQ_HOST set_parameter shovel "${EXCHANGE_PATTERN_2}-activemq" \
"{'src-protocol': 'amqp091', 'src-uri': 'amqp://guest:guest@rabbitmq:5672', 'src-exchange': \"$EXCHANGE_PATTERN_2\", 'src-exchange-key': '#', \
  'dest-protocol': 'amqp10', 'dest-uri': 'amqp://admin:admin@activemq:5672','dest-address': \"$EXCHANGE_PATTERN_2\"}"

rabbitmqctl --node $RABBITMQ_HOST set_parameter shovel "${EXCHANGE_PATTERN_3}-activemq" \
"{'src-protocol': 'amqp091', 'src-uri': 'amqp://guest:guest@rabbitmq:5672', 'src-exchange': \"$EXCHANGE_PATTERN_3\",'src-exchange-key': '#', \
  'dest-protocol': 'amqp10', 'dest-uri': 'amqp://admin:admin@activemq:5672','dest-address': \"$EXCHANGE_PATTERN_3\"}"
