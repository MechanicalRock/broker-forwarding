Feature: Persist wiretap queue traffic into S3

In order to persist tee'd requests from a wiretap queue
As a developer
I want to publish the request data in S3

Rules:
  - Distributed tracing is configured (XRay)
  - Queue message data is published to a file in JSON format
  - Path of the file should be in format "yyyy/MM/dd/<queue>_hh:mm:ss.mmm" (i.e. "2019/10/05/drainqueue_12:50:45.324")


Scenario: All queue messages are published to S3
  Given the wiretap queue has messages to be consumed
  When the lambda publisher is run
  Then log files should be published to S3 under the date and queue separated path
  And they should contain the queue messages

Scenario: We only acknowledge messages that have been written to S3
    Given the wiretap queue has messages to be consumed
    And a message has been drawn from the queue
    When we write the message to S3 and it throws an exception
    Then the message should not be acknowledged

Scenario: We only consume as many messages as we can process within the lambda timeout
  Given a lambda timeout of 5 seconds
  When we begin consuming messages
  Then we must finish processing before 5 seconds have passed

Scenario: We stop executing after being idle for a given timeout
  Given the wiretap queue has messages to be consumed
  When we consume the available messages
  And no new messages arrive for 5 seconds
  Then we should stop processing and exit