#!/bin/bash

chmod 700 /var/lib/rabbitmq
chmod 600 /var/lib/rabbitmq/.ssh/authorized_keys
/etc/init.d/ssh start
/usr/local/bin/docker-entrypoint.sh rabbitmq-server