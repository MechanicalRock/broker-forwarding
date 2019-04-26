#!/bin/sh

echo 'y' |ssh-keygen -t rsa -f controller -P ""

cat ./controller.pub > authorized_keys
