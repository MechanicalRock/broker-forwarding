Feature: Transparent forwarding of messages from Rabbitmq exchange to ActiveMQ destination

  Rules
    - forwarding messages has no impact on existing consumer queues on the source broker
    - all messages for selected exchanges are reliably forwarded to the destination broker
    - subscribers to destination mirror queues receive same messages as consumer queues

    Scenario: Publishing 10 messages results in 10 messages received on source and destination broker consumer queues
      Given message forwarding is activated
        When I publish 10 messages to the source broker exchange 
          Then my source broker consumer queue should receive 10 messages
          And my destination broker consumer queue should receive 10 messages
          And my destination broker mirror queue should receive 10 messages