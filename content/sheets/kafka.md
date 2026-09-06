# Kafka in Python - Comprehensive Documentation

## What is Apache Kafka?

**Definition:** Apache Kafka is a distributed event streaming platform designed to handle high-throughput, fault-tolerant, real-time data feeds. It acts as a message broker that enables applications to publish, subscribe to, store, and process streams of records in a distributed manner.

**Core Purpose:**

- **Decouple systems**: Enables independent scaling of data producers and consumers
- **Real-time processing**: Handles streaming data with low latency
- **Durability**: Persists messages to disk for fault tolerance
- **Scalability**: Distributes data across multiple servers (brokers)

**Key Concepts:**

- **Topic**: A category or feed name to which messages are published
- **Partition**: Ordered, immutable sequence of messages within a topic
- **Producer**: Application that publishes messages to Kafka topics
- **Consumer**: Application that subscribes to topics and processes messages
- **Broker**: Kafka server that stores and serves data
- **Consumer Group**: Set of consumers working together to consume a topic

---

## Installation

```bash
pip install kafka-python
```

**Purpose:** Install the Python client library for interacting with Apache Kafka clusters.

---

## Basic Producer

### What is a Producer?

**Definition:** A Kafka Producer is a client application that publishes (writes) messages to Kafka topics. It determines which partition to send messages to and handles batching, compression, and retries.

**Purpose:**

- Send data from applications to Kafka topics
- Handle message serialization (converting objects to bytes)
- Manage connection pooling and network failures
- Optimize throughput through batching

### Simple Producer

```python
from kafka import KafkaProducer
import json

# Create producer
producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

# Send message
producer.send('my-topic', {'key': 'value'})

# Flush and close
producer.flush()
producer.close()
```

**Parameters Explained:**

- `bootstrap_servers`: List of Kafka broker addresses for initial connection
- `value_serializer`: Function to convert message values to bytes
- `flush()`: Blocks until all pending messages are sent
- `close()`: Closes producer and releases resources

### Producer with Key

```python
producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    key_serializer=lambda k: k.encode('utf-8'),
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

producer.send('my-topic', key='my-key', value={'data': 'example'})
```

**Purpose of Message Keys:**

- **Partitioning**: Messages with the same key go to the same partition
- **Ordering**: Guarantees message order within a partition
- **Co-location**: Related messages are stored together

### Producer with Callback

```python
def on_success(metadata):
    print(f"Message sent to {metadata.topic} partition {metadata.partition} offset {metadata.offset}")

def on_error(e):
    print(f"Error: {e}")

future = producer.send('my-topic', {'message': 'hello'})
future.add_callback(on_success)
future.add_errback(on_error)
```

**Purpose:** Handle asynchronous send results for monitoring and error handling.

**Metadata Attributes:**

- `topic`: The topic name where message was sent
- `partition`: Partition number (0-indexed)
- `offset`: Position of message in the partition

---

## Basic Consumer

### What is a Consumer?

**Definition:** A Kafka Consumer is a client application that subscribes to (reads) messages from Kafka topics. It maintains an offset (position) in each partition to track which messages have been processed.

**Purpose:**

- Read messages from Kafka topics
- Handle message deserialization (converting bytes to objects)
- Manage offset tracking and commits
- Enable parallel processing through consumer groups

### Simple Consumer

```python
from kafka import KafkaConsumer
import json

consumer = KafkaConsumer(
    'my-topic',
    bootstrap_servers=['localhost:9092'],
    auto_offset_reset='earliest',
    enable_auto_commit=True,
    group_id='my-group',
    value_deserializer=lambda m: json.loads(m.decode('utf-8'))
)

for message in consumer:
    print(f"Topic: {message.topic}")
    print(f"Partition: {message.partition}")
    print(f"Offset: {message.offset}")
    print(f"Key: {message.key}")
    print(f"Value: {message.value}")
```

**Parameters Explained:**

- `auto_offset_reset`: Where to start reading when no offset exists
  - `'earliest'`: Start from beginning of partition
  - `'latest'`: Start from newest messages
  - `'none'`: Throw exception if no offset found
- `enable_auto_commit`: Automatically commit offsets periodically
- `group_id`: Consumer group name for coordinated consumption
- `value_deserializer`: Function to convert message bytes to objects

**Message Attributes:**

- `topic`: Topic name
- `partition`: Partition number
- `offset`: Message position in partition
- `key`: Message key (optional)
- `value`: Message payload
- `timestamp`: When message was produced

### Consumer with Multiple Topics

```python
consumer = KafkaConsumer(
    'topic1', 'topic2', 'topic3',
    bootstrap_servers=['localhost:9092'],
    group_id='my-group'
)
```

**Purpose:** Subscribe to multiple topics simultaneously for consolidated processing.

### Manual Offset Commit

```python
consumer = KafkaConsumer(
    'my-topic',
    bootstrap_servers=['localhost:9092'],
    enable_auto_commit=False,
    group_id='my-group'
)

for message in consumer:
    # Process message
    print(message.value)
    # Manually commit
    consumer.commit()
```

**Purpose:** Provides control over when offsets are committed, ensuring "at-least-once" or "exactly-once" processing semantics.

**When to use:**

- Need to ensure message processing before committing
- Implementing transactional processing
- Custom error handling and retry logic

---

## Configuration Options

### Producer Configuration

```python
producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    acks='all',  # 0, 1, or 'all'
    retries=3,
    batch_size=16384,
    linger_ms=10,
    buffer_memory=33554432,
    compression_type='gzip',  # None, 'gzip', 'snappy', 'lz4', 'zstd'
    max_in_flight_requests_per_connection=5
)
```

**Configuration Parameters Explained:**

- **acks** (Acknowledgment Level):

  - `0`: No acknowledgment (fastest, least safe)
  - `1`: Leader broker acknowledges (balanced)
  - `'all'`: All replicas acknowledge (slowest, most safe)
  - **Purpose**: Controls durability vs. speed trade-off

- **retries**: Number of retry attempts for failed sends

  - **Purpose**: Handles transient network failures

- **batch_size**: Maximum bytes to batch before sending (default: 16384)

  - **Purpose**: Improves throughput by grouping messages

- **linger_ms**: Time to wait before sending batch (default: 0)

  - **Purpose**: Allows more messages to accumulate in batch

- **buffer_memory**: Total memory for buffering (default: 33554432 = 32MB)

  - **Purpose**: Prevents OutOfMemory when producers are faster than network

- **compression_type**: Compress messages to reduce network bandwidth

  - `'gzip'`: Best compression, slower
  - `'snappy'`: Balanced compression/speed
  - `'lz4'`: Fast compression
  - `'zstd'`: Modern, efficient compression

- **max_in_flight_requests_per_connection**: Max unacknowledged requests per connection
  - **Purpose**: Controls throughput vs. ordering trade-off
  - Set to 1 for strict ordering

### Consumer Configuration

```python
consumer = KafkaConsumer(
    'my-topic',
    bootstrap_servers=['localhost:9092'],
    group_id='my-group',
    auto_offset_reset='earliest',  # 'earliest', 'latest', 'none'
    enable_auto_commit=True,
    auto_commit_interval_ms=5000,
    max_poll_records=500,
    max_poll_interval_ms=300000,
    session_timeout_ms=10000,
    heartbeat_interval_ms=3000
)
```

**Configuration Parameters Explained:**

- **group_id**: Consumer group identifier

  - **Purpose**: Enables load balancing and fault tolerance
  - Consumers in same group share partition consumption

- **auto_commit_interval_ms**: Frequency of automatic offset commits (default: 5000)

  - **Purpose**: Controls commit frequency vs. duplicate processing risk

- **max_poll_records**: Maximum records returned per poll() call (default: 500)

  - **Purpose**: Controls memory usage and processing batch size

- **max_poll_interval_ms**: Maximum time between poll() calls (default: 300000 = 5 min)

  - **Purpose**: Prevents consumer being marked as dead during slow processing

- **session_timeout_ms**: Maximum time between heartbeats (default: 10000 = 10 sec)

  - **Purpose**: Controls failure detection speed
  - Lower = faster detection, but more sensitive to GC pauses

- **heartbeat_interval_ms**: Frequency of heartbeat to coordinator (default: 3000 = 3 sec)
  - **Purpose**: Keeps consumer alive in group
  - Should be lower than session_timeout_ms / 3

---

## Advanced Operations

### Seek to Specific Offset

```python
from kafka import TopicPartition

tp = TopicPartition('my-topic', 0)
consumer.assign([tp])
consumer.seek(tp, 10)  # Seek to offset 10
```

**Purpose:** Manually control consumer position for replay or skipping messages.

**Use Cases:**

- Reprocessing historical data
- Skipping corrupted messages
- Time-travel debugging
- Implementing custom offset management

### Seek to Beginning/End

```python
consumer.seek_to_beginning()
consumer.seek_to_end()
```

**Purpose:**

- `seek_to_beginning()`: Reprocess all available messages
- `seek_to_end()`: Skip to latest messages (ignore backlog)

### Get Topic Partitions

```python
partitions = consumer.partitions_for_topic('my-topic')
print(f"Partitions: {partitions}")
```

**Purpose:** Discover partition topology for manual partition assignment or monitoring.

### Get Current Position

```python
tp = TopicPartition('my-topic', 0)
position = consumer.position(tp)
print(f"Current position: {position}")
```

**Purpose:** Monitor consumer progress and calculate lag (difference between current position and latest offset).

### Pause and Resume

```python
# Pause consumption
consumer.pause(*consumer.assignment())

# Resume consumption
consumer.resume(*consumer.assignment())
```

**Purpose:** Temporarily stop consuming without closing consumer.

**Use Cases:**

- Backpressure handling (slow downstream system)
- Maintenance windows
- Dynamic rate limiting

---

## Admin Operations

### What are Admin Operations?

**Definition:** Administrative operations for managing Kafka cluster resources like topics, partitions, and configurations programmatically.

**Purpose:** Automate infrastructure management and enable self-service topic creation.

### Create Topics

```python
from kafka.admin import KafkaAdminClient, NewTopic

admin = KafkaAdminClient(bootstrap_servers=['localhost:9092'])

topic = NewTopic(
    name='new-topic',
    num_partitions=3,
    replication_factor=1
)

admin.create_topics([topic])
admin.close()
```

**Parameters Explained:**

- `num_partitions`: Number of partitions (parallelism level)
- `replication_factor`: Number of copies across brokers (fault tolerance)

**Best Practices:**

- More partitions = higher throughput but more overhead
- Replication factor ≥ 3 for production
- Consider retention policies and compaction

### Delete Topics

```python
admin.delete_topics(['topic-to-delete'])
```

**Purpose:** Remove topics and all associated data. Use with caution in production.

### List Topics

```python
topics = admin.list_topics()
print(f"Available topics: {topics}")
```

**Purpose:** Discover available topics for monitoring or dynamic subscription.

---

## Error Handling

### Why Error Handling Matters

**Purpose:** Kafka operations involve network I/O and can fail due to broker issues, network problems, or configuration errors. Proper error handling ensures system reliability.

### Producer Error Handling

```python
from kafka.errors import KafkaError

try:
    future = producer.send('my-topic', {'data': 'value'})
    record_metadata = future.get(timeout=10)
except KafkaError as e:
    print(f"Failed to send message: {e}")
```

**Common Errors:**

- `KafkaTimeoutError`: Broker unreachable or overloaded
- `MessageSizeTooLargeError`: Message exceeds broker limits
- `TopicAuthorizationFailedError`: Insufficient permissions

### Consumer Error Handling

```python
from kafka.errors import KafkaError

try:
    for message in consumer:
        try:
            # Process message
            process(message.value)
        except Exception as e:
            print(f"Error processing message: {e}")
            continue
except KafkaError as e:
    print(f"Kafka error: {e}")
```

**Best Practices:**

- Separate Kafka errors from processing errors
- Implement dead letter queues for poison messages
- Log errors with context (topic, partition, offset)
- Monitor error rates

---

## Common Patterns

### Batch Processing

```python
messages = []
for message in consumer:
    messages.append(message)
    if len(messages) >= 100:
        # Process batch
        process_batch(messages)
        messages = []
        consumer.commit()
```

**Purpose:** Improve throughput by processing messages in groups.

**Benefits:**

- Amortize network/database overhead
- Enable bulk operations (batch inserts)
- Reduce per-message processing cost

**Trade-offs:**

- Increased latency
- Higher memory usage
- Risk of data loss if process crashes before commit

### Asynchronous Producer

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

def send_async(producer, topic, message):
    producer.send(topic, message)

executor = ThreadPoolExecutor(max_workers=10)
for i in range(1000):
    executor.submit(send_async, producer, 'my-topic', {'id': i})
```

**Purpose:** Maximize producer throughput by parallelizing sends.

**Use Cases:**

- High-volume data ingestion
- Non-blocking application code
- CPU-bound serialization

### Context Manager

```python
from contextlib import closing

with closing(KafkaProducer(bootstrap_servers=['localhost:9092'])) as producer:
    producer.send('my-topic', b'message')
    producer.flush()
```

**Purpose:** Ensure proper resource cleanup (flush pending messages, close connections).

---

## Security (SSL/SASL)

### Why Security Matters

**Purpose:** Protect data in transit and authenticate clients to prevent unauthorized access.

### SSL Configuration

```python
producer = KafkaProducer(
    bootstrap_servers=['localhost:9093'],
    security_protocol='SSL',
    ssl_cafile='/path/to/ca-cert',
    ssl_certfile='/path/to/client-cert',
    ssl_keyfile='/path/to/client-key'
)
```

**Purpose:** Encrypt communication between client and broker using TLS/SSL.

**Certificates Explained:**

- `ssl_cafile`: Certificate Authority (validates broker identity)
- `ssl_certfile`: Client certificate (proves client identity)
- `ssl_keyfile`: Private key for client certificate

### SASL Authentication

```python
producer = KafkaProducer(
    bootstrap_servers=['localhost:9093'],
    security_protocol='SASL_SSL',
    sasl_mechanism='PLAIN',
    sasl_plain_username='username',
    sasl_plain_password='password'
)
```

**Purpose:** Authenticate clients using username/password or Kerberos.

**SASL Mechanisms:**

- `PLAIN`: Simple username/password (use with SSL)
- `SCRAM-SHA-256/512`: Secure password-based authentication
- `GSSAPI`: Kerberos authentication
- `OAUTHBEARER`: OAuth 2.0 token-based authentication

---

## Performance Tips

### Optimization Strategies

1. **Use batch sending for producers with appropriate `linger_ms` and `batch_size`**

   - **Purpose**: Reduce network overhead by grouping messages
   - **Recommendation**: Set `linger_ms=10-50` and `batch_size=16384-131072`

2. **Enable compression (`gzip`, `snappy`, `lz4`, or `zstd`)**

   - **Purpose**: Reduce network bandwidth and broker storage
   - **Recommendation**: Use `snappy` for balanced performance, `zstd` for best compression

3. **Adjust `max_poll_records` for consumers based on processing speed**

   - **Purpose**: Prevent consumer timeout from slow processing
   - **Recommendation**: Lower for slow processing, higher for fast processing

4. **Use appropriate `acks` setting (0 for speed, 'all' for durability)**

   - **Purpose**: Balance throughput vs. data safety
   - **Recommendation**: Use `acks='all'` with `min.insync.replicas=2` for critical data

5. **Partition your topics for parallelism**

   - **Purpose**: Enable horizontal scaling of consumers
   - **Recommendation**: Partitions = number of parallel consumers needed

6. **Use consumer groups for load distribution**

   - **Purpose**: Distribute partition consumption across multiple consumers
   - **Recommendation**: Max consumers = number of partitions

7. **Monitor lag and adjust consumer count accordingly**
   - **Purpose**: Ensure consumers keep up with producers
   - **Recommendation**: Add consumers when lag consistently increases

---

## Top 5 Kafka Use Cases

### 1. Data Streaming

**Definition:** Real-time data streaming aggregates information from multiple sources (social media, IoT devices, applications) through Kafka topics to processing engines like Spark Streaming and storage systems.

**Purpose:**

- Unify disparate data sources into a single pipeline
- Enable real-time analytics and decision-making
- Buffer high-volume data streams
- Decouple data producers from consumers

**Key Benefits:**

- **Scalability**: Handle millions of events per second
- **Fault Tolerance**: No data loss even if processing fails
- **Flexibility**: Multiple consumers can process same stream differently
- **Real-time**: Sub-second latency for time-sensitive applications

**Common Scenarios:**

- IoT sensor data aggregation
- Social media feed processing
- Financial market data distribution
- Application event streaming

```python
# Example: Multi-Source IoT & Social Media Stream Aggregator
import asyncio
from kafka import KafkaProducer, KafkaConsumer
from kafka.partitioner import Murmur2Partitioner
import json
import time
import random
from concurrent.futures import ThreadPoolExecutor
import threading
from typing import Dict, List, Any

class StreamAggregator:
    def __init__(self, bootstrap_servers):
        self.producer = KafkaProducer(
            bootstrap_servers=bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            key_serializer=lambda k: k.encode('utf-8'),
            partitioner=Murmur2Partitioner(),
            compression_type='snappy',
            acks='all',
            retries=3,
            max_in_flight_requests_per_connection=1
        )
        self._running = False

    def stream_social_media(self, platform, num_messages=100):
        """Simulate streaming from multiple social platforms"""
        for i in range(num_messages):
            event = {
                'event_id': f'{platform}_{i}_{int(time.time())}',
                'platform': platform,
                'user_id': f'user_{i % 1000}',
                'content': f'Streaming content from {platform}',
                'engagement': {'likes': i * 10, 'shares': i * 2, 'comments': i * 5},
                'timestamp': time.time(),
                'sentiment_score': round(random.uniform(-1, 1), 2),
                'location': {'lat': random.uniform(-90, 90), 'lon': random.uniform(-180, 180)}
            }
            # Use user_id as key for partition consistency
            self.producer.send('social-stream', key=event['user_id'], value=event)
            time.sleep(0.01)

    def stream_iot_sensors(self, device_type, num_readings=100):
        """Simulate IoT sensor data streaming"""
        for i in range(num_readings):
            reading = {
                'device_id': f'{device_type}_{i % 50}',
                'device_type': device_type,
                'reading': random.uniform(20, 100),
                'battery_level': random.uniform(0, 100),
                'signal_strength': random.randint(-100, -30),
                'timestamp': time.time(),
                'metadata': {'firmware': 'v2.1.3', 'location': 'warehouse_A'}
            }
            self.producer.send('iot-stream', key=reading['device_id'], value=reading)
            time.sleep(0.005)

    def stop(self):
        """Stop the producer"""
        self.producer.flush()
        self.producer.close()
        self._running = False

# Consumer with real-time processing
class StreamProcessor:
    def __init__(self, bootstrap_servers, topics):
        self.consumer = KafkaConsumer(
            *topics,
            bootstrap_servers=bootstrap_servers,
            group_id='stream-processor-group',
            auto_offset_reset='latest',
            enable_auto_commit=False,
            max_poll_records=500,
            value_deserializer=lambda m: json.loads(m.decode('utf-8'))
        )
        self.batch = []
        self._running = False

    def process_stream(self):
        """Process stream with windowing and aggregation"""
        window_data = {'social': [], 'iot': []}
        window_start = time.time()
        self._running = True

        try:
            for message in self.consumer:
                if not self._running:
                    break

                # Window-based processing (5 second windows)
                if time.time() - window_start > 5:
                    self.aggregate_and_forward(window_data)
                    window_data = {'social': [], 'iot': []}
                    window_start = time.time()

                if message.topic == 'social-stream':
                    window_data['social'].append(message.value)
                elif message.topic == 'iot-stream':
                    window_data['iot'].append(message.value)

                self.batch.append(message)
                if len(self.batch) >= 100:
                    self.consumer.commit()
                    self.batch = []
        except Exception as e:
            print(f"Error in process_stream: {e}")
        finally:
            self.consumer.close()

    def aggregate_and_forward(self, window_data):
        """Aggregate window data and forward to Spark/analytics"""
        if window_data['social']:
            avg_sentiment = sum(d['sentiment_score'] for d in window_data['social']) / len(window_data['social'])
            total_events = len(window_data['social'])
            avg_likes = sum(d['engagement']['likes'] for d in window_data['social']) / total_events
            print(f"Window: {total_events} social events, Avg Sentiment: {avg_sentiment:.2f}, Avg Likes: {avg_likes:.1f}")

        if window_data['iot']:
            avg_reading = sum(d['reading'] for d in window_data['iot']) / len(window_data['iot'])
            avg_battery = sum(d['battery_level'] for d in window_data['iot']) / len(window_data['iot'])
            print(f"Window: {len(window_data['iot'])} IoT readings, Avg Reading: {avg_reading:.2f}, Avg Battery: {avg_battery:.2f}")

    def stop(self):
        """Stop the consumer"""
        self._running = False
        self.consumer.close()

# Enhanced multi-threaded processing with error handling
class EnhancedStreamProcessor(StreamProcessor):
    def __init__(self, bootstrap_servers, topics, worker_threads=4):
        super().__init__(bootstrap_servers, topics)
        self.worker_threads = worker_threads
        self.processing_queue = []
        self.lock = threading.Lock()

    def process_stream_with_threads(self):
        """Process stream using thread pool for better performance"""
        window_data = {'social': [], 'iot': []}
        window_start = time.time()
        self._running = True

        with ThreadPoolExecutor(max_workers=self.worker_threads) as executor:
            try:
                for message in self.consumer:
                    if not self._running:
                        break

                    # Submit message processing to thread pool
                    if message.topic == 'social-stream':
                        future = executor.submit(self.process_social_message, message.value)
                    elif message.topic == 'iot-stream':
                        future = executor.submit(self.process_iot_message, message.value)

                    # Window-based processing (5 second windows)
                    if time.time() - window_start > 5:
                        self.aggregate_and_forward(window_data)
                        window_data = {'social': [], 'iot': []}
                        window_start = time.time()

                    self.batch.append(message)
                    if len(self.batch) >= 100:
                        self.consumer.commit()
                        self.batch = []
            except Exception as e:
                print(f"Error in enhanced process_stream: {e}")
            finally:
                self.consumer.close()

    def process_social_message(self, message):
        """Process individual social media message"""
        # Add your custom processing logic here
        # This could include NLP, sentiment analysis, etc.
        return message

    def process_iot_message(self, message):
        """Process individual IoT sensor message"""
        # Add your custom processing logic here
        # This could include anomaly detection, filtering, etc.
        return message

# Main execution with proper cleanup
def main():
    bootstrap_servers = ['localhost:9092']

    # Create aggregator and processor
    aggregator = StreamAggregator(bootstrap_servers)
    processor = StreamProcessor(bootstrap_servers, ['social-stream', 'iot-stream'])

    try:
        # Start streaming in parallel
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = [
                executor.submit(aggregator.stream_social_media, 'twitter', 1000),
                executor.submit(aggregator.stream_social_media, 'facebook', 1000),
                executor.submit(aggregator.stream_iot_sensors, 'temperature', 1000),
                executor.submit(aggregator.stream_iot_sensors, 'pressure', 1000)
            ]

            # Start processing in a separate thread
            processing_thread = threading.Thread(target=processor.process_stream)
            processing_thread.start()

            # Wait for all streaming tasks to complete
            for future in futures:
                future.result()

            # Give processing time to finish
            time.sleep(2)
            processor.stop()
            processing_thread.join()

    except KeyboardInterrupt:
        print("Received interrupt signal, stopping...")
    except Exception as e:
        print(f"Error in main execution: {e}")
    finally:
        aggregator.stop()
        processor.stop()
        print("All components stopped gracefully")

if __name__ == "__main__":
    main()

```

---

### 2. Log Aggregation

**Definition:** Collecting logs from multiple services and applications, centralizing them through Kafka, and forwarding to processing systems like Spark and analytics platforms (ELK Stack, Splunk).

**Purpose:**

- Centralize distributed logs for easier debugging
- Enable real-time log analysis and alerting
- Reduce storage costs through efficient compression
- Provide audit trail for compliance

**Key Benefits:**

- **Unified View**: See logs from all services in one place
- **Real-time Alerting**: Detect and respond to issues immediately
- **Scalability**: Handle terabytes of logs per day
- **Decoupling**: Log producers don't depend on log processors

**Common Scenarios:**

- Microservices log aggregation
- Error pattern detection
- Security event monitoring
- Performance metrics collection

**Architecture:**

- Applications → Kafka Topics (by log level) → Log Analyzer → ELK/Splunk

```python
# Example: Enterprise Log Aggregation with ELK Stack Integration
import logging
from kafka import KafkaProducer, KafkaConsumer
from kafka.errors import KafkaError
import json
import hashlib
from datetime import datetime
from collections import defaultdict

class DistributedLogAggregator:
    def __init__(self, bootstrap_servers, app_name):
        self.app_name = app_name
        self.producer = KafkaProducer(
            bootstrap_servers=bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            compression_type='gzip',
            acks=1,
            retries=5,
            max_in_flight_requests_per_connection=5
        )

    def emit_log(self, level, message, **kwargs):
        """Emit structured logs to Kafka"""
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'app_name': self.app_name,
            'level': level,
            'message': message,
            'trace_id': kwargs.get('trace_id', self._generate_trace_id()),
            'host': kwargs.get('host', 'unknown'),
            'service': kwargs.get('service', 'default'),
            'environment': kwargs.get('environment', 'production'),
            'metadata': kwargs.get('metadata', {}),
            'stack_trace': kwargs.get('stack_trace', None)
        }

        # Route by log level to different topics
        topic = f'logs-{level.lower()}'
        try:
            self.producer.send(topic, value=log_entry)
        except KafkaError as e:
            # Fallback logging
            print(f"Failed to send log: {e}")

    def _generate_trace_id(self):
        return hashlib.md5(f"{time.time()}{random.random()}".encode()).hexdigest()

class LogAnalyzer:
    def __init__(self, bootstrap_servers):
        self.consumer = KafkaConsumer(
            'logs-error', 'logs-warning', 'logs-info',
            bootstrap_servers=bootstrap_servers,
            group_id='log-analyzer',
            auto_offset_reset='earliest',
            enable_auto_commit=False,
            value_deserializer=lambda m: json.loads(m.decode('utf-8'))
        )
        self.error_patterns = defaultdict(int)
        self.alerts = []

    def analyze_logs(self):
        """Real-time log analysis with pattern detection"""
        batch = []
        alert_threshold = {'error': 10, 'warning': 50}
        window_start = time.time()

        for message in self.consumer:
            log = message.value
            batch.append(message)

            # Pattern detection
            if log['level'] in ['ERROR', 'WARNING']:
                pattern = self._extract_pattern(log['message'])
                self.error_patterns[pattern] += 1

                # Alert on threshold breach
                if self.error_patterns[pattern] >= alert_threshold.get(log['level'].lower(), 100):
                    self.trigger_alert(log, pattern, self.error_patterns[pattern])
                    self.error_patterns[pattern] = 0

            # Process in micro-batches
            if len(batch) >= 1000 or (time.time() - window_start) > 10:
                self.process_batch(batch)
                self.consumer.commit()
                batch = []
                window_start = time.time()

    def _extract_pattern(self, message):
        """Extract error pattern by removing dynamic values"""
        import re
        # Remove numbers, UUIDs, timestamps
        pattern = re.sub(r'\d+', 'N', message)
        pattern = re.sub(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', 'UUID', pattern)
        return pattern[:100]

    def trigger_alert(self, log, pattern, count):
        """Trigger alert for repeated errors"""
        alert = {
            'alert_type': 'ERROR_SPIKE',
            'pattern': pattern,
            'count': count,
            'service': log['service'],
            'environment': log['environment'],
            'first_seen': log['timestamp'],
            'severity': 'HIGH' if log['level'] == 'ERROR' else 'MEDIUM'
        }
        print(f"🚨 ALERT: {alert}")
        # Forward to alerting system (PagerDuty, Slack, etc.)

    def process_batch(self, batch):
        """Process batch and forward to ELK/Splunk"""
        print(f"Processed {len(batch)} logs, {len(self.error_patterns)} unique error patterns")
        # Forward to Elasticsearch, Splunk, etc.

# Usage
logger = DistributedLogAggregator(['localhost:9092'], 'payment-service')
logger.emit_log('ERROR', 'Payment processing failed',
                service='payment', trace_id='abc123',
                metadata={'amount': 99.99, 'user_id': 'U12345'})

analyzer = LogAnalyzer(['localhost:9092'])
analyzer.analyze_logs()
```

---

### 3. Message Queuing

**Definition:** Using Kafka as a distributed message queue to decouple producers and consumers, enabling multiple producers to send messages and multiple consumers to process them independently with guaranteed delivery.

**Purpose:**

- Decouple services for independent scaling
- Ensure reliable message delivery with retries
- Enable asynchronous processing
- Load balance work across multiple workers

**Key Benefits:**

- **Reliability**: Messages persist until successfully processed
- **Ordering**: Maintain message order within partitions
- **Priority Queues**: Route high-priority tasks to dedicated topics
- **Dead Letter Queues**: Isolate failing messages for investigation

**Common Scenarios:**

- Background job processing
- Email/notification delivery
- Payment processing
- Report generation
- Data import/export tasks

**Features:**

- Priority-based task routing
- Automatic retry with exponential backoff
- Dead letter queue for failed messages
- Multiple workers for parallel processing

```python
# Example: Distributed Task Queue with Priority & Dead Letter Queue
from kafka import KafkaProducer, KafkaConsumer, TopicPartition
from kafka.admin import KafkaAdminClient, NewTopic
import json
import time
from enum import Enum
from dataclasses import dataclass, asdict
import threading

class TaskPriority(Enum):
    LOW = 0
    MEDIUM = 1
    HIGH = 2
    CRITICAL = 3

@dataclass
class Task:
    task_id: str
    task_type: str
    priority: int
    payload: dict
    retry_count: int = 0
    max_retries: int = 3
    created_at: float = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = time.time()

class TaskQueueProducer:
    def __init__(self, bootstrap_servers):
        self.producer = KafkaProducer(
            bootstrap_servers=bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            key_serializer=lambda k: k.encode('utf-8'),
            acks='all',
            retries=3
        )
        self.ensure_topics()

    def ensure_topics(self):
        """Create priority-based topics"""
        admin = KafkaAdminClient(bootstrap_servers=['localhost:9092'])
        topics = [
            NewTopic('tasks-critical', num_partitions=3, replication_factor=1),
            NewTopic('tasks-high', num_partitions=3, replication_factor=1),
            NewTopic('tasks-medium', num_partitions=5, replication_factor=1),
            NewTopic('tasks-low', num_partitions=5, replication_factor=1),
            NewTopic('tasks-dlq', num_partitions=1, replication_factor=1)
        ]
        try:
            admin.create_topics(topics)
        except:
            pass

    def submit_task(self, task: Task):
        """Submit task to appropriate priority queue"""
        topic = f'tasks-{TaskPriority(task.priority).name.lower()}'
        future = self.producer.send(
            topic,
            key=task.task_id,
            value=asdict(task)
        )
        future.add_callback(lambda m: print(f"✓ Task {task.task_id} queued to {topic}"))
        future.add_errback(lambda e: print(f"✗ Failed to queue task: {e}"))
        return future

class TaskQueueConsumer:
    def __init__(self, bootstrap_servers, worker_id):
        self.worker_id = worker_id
        # Subscribe to multiple priority queues with weighted polling
        self.consumers = {
            'critical': self._create_consumer(bootstrap_servers, 'tasks-critical', 'workers-critical'),
            'high': self._create_consumer(bootstrap_servers, 'tasks-high', 'workers-high'),
            'medium': self._create_consumer(bootstrap_servers, 'tasks-medium', 'workers-medium'),
            'low': self._create_consumer(bootstrap_servers, 'tasks-low', 'workers-low')
        }
        self.dlq_producer = KafkaProducer(
            bootstrap_servers=bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )

    def _create_consumer(self, servers, topic, group):
        return KafkaConsumer(
            topic,
            bootstrap_servers=servers,
            group_id=group,
            enable_auto_commit=False,
            max_poll_records=10,
            value_deserializer=lambda m: json.loads(m.decode('utf-8'))
        )

    def start_processing(self):
        """Process tasks with priority-based polling"""
        # Weighted polling: check critical more frequently
        poll_weights = {'critical': 10, 'high': 5, 'medium': 2, 'low': 1}

        while True:
            for priority, weight in poll_weights.items():
                for _ in range(weight):
                    messages = self.consumers[priority].poll(timeout_ms=100, max_records=10)

                    for tp, msgs in messages.items():
                        for message in msgs:
                            self.process_task(message, priority)
                        self.consumers[priority].commit()

    def process_task(self, message, priority):
        """Process individual task with retry logic"""
        task_data = message.value
        task = Task(**task_data)

        try:
            print(f"[Worker {self.worker_id}] Processing {priority} task: {task.task_id}")

            # Simulate task processing
            if task.task_type == 'email':
                self.send_email(task.payload)
            elif task.task_type == 'report':
                self.generate_report(task.payload)
            elif task.task_type == 'payment':
                self.process_payment(task.payload)

            print(f"[Worker {self.worker_id}] ✓ Completed task: {task.task_id}")

        except Exception as e:
            print(f"[Worker {self.worker_id}] ✗ Failed task: {task.task_id} - {e}")
            self.handle_failure(task, e)

    def handle_failure(self, task: Task, error):
        """Handle failed tasks with retry and DLQ"""
        task.retry_count += 1

        if task.retry_count < task.max_retries:
            # Retry with exponential backoff
            time.sleep(2 ** task.retry_count)
            print(f"Retrying task {task.task_id} (attempt {task.retry_count}/{task.max_retries})")
            # Re-queue to same priority
            topic = f'tasks-{TaskPriority(task.priority).name.lower()}'
            self.dlq_producer.send(topic, value=asdict(task))
        else:
            # Send to Dead Letter Queue
            dlq_entry = {
                **asdict(task),
                'failed_at': time.time(),
                'error': str(error),
                'worker_id': self.worker_id
            }
            self.dlq_producer.send('tasks-dlq', value=dlq_entry)
            print(f"Task {task.task_id} sent to DLQ after {task.retry_count} retries")

    def send_email(self, payload):
        time.sleep(0.1)  # Simulate work

    def generate_report(self, payload):
        time.sleep(0.5)

    def process_payment(self, payload):
        time.sleep(0.2)
        if random.random() < 0.1:  # 10% failure rate
            raise Exception("Payment gateway timeout")

# Usage: Multiple producers and consumers
producer = TaskQueueProducer(['localhost:9092'])

# Submit tasks with different priorities
for i in range(100):
    priority = random.choice([p.value for p in TaskPriority])
    task = Task(
        task_id=f'task_{i}',
        task_type=random.choice(['email', 'report', 'payment']),
        priority=priority,
        payload={'data': f'payload_{i}'}
    )
    producer.submit_task(task)

# Start multiple workers
workers = []
for worker_id in range(5):
    worker = TaskQueueConsumer(['localhost:9092'], f'W{worker_id}')
    thread = threading.Thread(target=worker.start_processing, daemon=True)
    thread.start()
    workers.append(thread)
```

---

### 4. Web Activity Tracking

**Definition:** Tracking user activities on websites and applications, sending events through Kafka to analytics engines like Spark for real-time analysis, personalization, and reporting.

**Purpose:**

- Understand user behavior in real-time
- Enable personalized user experiences
- Detect anomalies and fraud
- Optimize conversion funnels
- Measure marketing campaign effectiveness

**Key Benefits:**

- **Real-time**: Respond to user actions immediately
- **Scalability**: Handle millions of events per second
- **Flexibility**: Multiple analytics pipelines from same data
- **Historical**: Store events for long-term analysis

**Common Scenarios:**

- Page view tracking
- Click stream analysis
- E-commerce conversion funnel
- A/B testing
- User session analysis
- Churn prediction
- Recommendation engines

**Tracked Events:**

- Page views, clicks, form submissions
- Purchases and cart additions
- Video plays, scrolls, hovers
- Search queries
- User authentication events

```python
# Example: Real-time User Behavior Analytics Pipeline
from kafka import KafkaProducer, KafkaConsumer
import json
import time
from collections import defaultdict
from datetime import datetime, timedelta
import uuid

class WebAnalyticsTracker:
    def __init__(self, bootstrap_servers):
        self.producer = KafkaProducer(
            bootstrap_servers=bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            key_serializer=lambda k: k.encode('utf-8'),
            compression_type='lz4',
            linger_ms=10,
            batch_size=32768
        )
        self.session_cache = {}

    def track_event(self, user_id, event_type, properties):
        """Track various user events with session management"""
        session_id = self.session_cache.get(user_id, str(uuid.uuid4()))
        self.session_cache[user_id] = session_id

        event = {
            'event_id': str(uuid.uuid4()),
            'user_id': user_id,
            'session_id': session_id,
            'event_type': event_type,
            'timestamp': time.time(),
            'properties': properties,
            'user_agent': properties.get('user_agent', 'Unknown'),
            'ip_address': properties.get('ip', '0.0.0.0'),
            'referrer': properties.get('referrer'),
            'utm_params': properties.get('utm', {})
        }

        # Partition by user_id for session continuity
        self.producer.send('web-events', key=user_id, value=event)

    def track_page_view(self, user_id, page_url, page_title, **kwargs):
        self.track_event(user_id, 'page_view', {
            'page_url': page_url,
            'page_title': page_title,
            **kwargs
        })

    def track_click(self, user_id, element_id, element_text, **kwargs):
        self.track_event(user_id, 'click', {
            'element_id': element_id,
            'element_text': element_text,
            **kwargs
        })

    def track_purchase(self, user_id, order_id, items, total, **kwargs):
        self.track_event(user_id, 'purchase', {
            'order_id': order_id,
            'items': items,
            'total': total,
            'currency': kwargs.get('currency', 'USD'),
            **kwargs
        })

class RealTimeAnalyticsEngine:
    def __init__(self, bootstrap_servers):
        self.consumer = KafkaConsumer(
            'web-events',
            bootstrap_servers=bootstrap_servers,
            group_id='analytics-engine',
            auto_offset_reset='latest',
            enable_auto_commit=False,
            max_poll_records=1000,
            value_deserializer=lambda m: json.loads(m.decode('utf-8'))
        )

        # Real-time metrics
        self.metrics = {
            'active_users': set(),
            'page_views': defaultdict(int),
            'conversions': 0,
            'revenue': 0.0,
            'session_data': defaultdict(list),
            'funnel_data': defaultdict(lambda: {'started': 0, 'completed': 0}),
            'cohorts': defaultdict(lambda: defaultdict(int))
        }

        self.window_start = time.time()
        self.anomaly_detector = AnomalyDetector()

    def process_events(self):
        """Process events with real-time aggregations"""
        batch = []

        for message in self.consumer:
            event = message.value
            batch.append(message)

            # Update real-time metrics
            self.update_metrics(event)

            # Sliding window (1 minute)
            if time.time() - self.window_start > 60:
                self.compute_window_metrics()
                self.window_start = time.time()
                self.metrics['active_users'].clear()

            # Process in micro-batches
            if len(batch) >= 1000:
                self.process_batch(batch)
                self.consumer.commit()
                batch = []

    def update_metrics(self, event):
        """Update real-time metrics for dashboards"""
        user_id = event['user_id']
        event_type = event['event_type']

        # Active users
        self.metrics['active_users'].add(user_id)

        # Page views
        if event_type == 'page_view':
            page = event['properties']['page_url']
            self.metrics['page_views'][page] += 1

            # Track user journey
            self.metrics['session_data'][event['session_id']].append({
                'page': page,
                'timestamp': event['timestamp']
            })

        # Conversions & Revenue
        elif event_type == 'purchase':
            self.metrics['conversions'] += 1
            self.metrics['revenue'] += event['properties']['total']

            # Funnel analysis
            session_id = event['session_id']
            journey = self.metrics['session_data'][session_id]
            if any('/product' in step['page'] for step in journey):
                self.metrics['funnel_data']['product_page']['completed'] += 1

        # Anomaly detection
        if self.anomaly_detector.is_anomaly(event):
            self.trigger_anomaly_alert(event)

    def compute_window_metrics(self):
        """Compute and emit window-based metrics"""
        active_users = len(self.metrics['active_users'])
        total_page_views = sum(self.metrics['page_views'].values())

        window_metrics = {
            'timestamp': datetime.utcnow().isoformat(),
            'active_users': active_users,
            'total_page_views': total_page_views,
            'top_pages': dict(sorted(self.metrics['page_views'].items(),
                                    key=lambda x: x[1], reverse=True)[:10]),
            'conversions': self.metrics['conversions'],
            'revenue': self.metrics['revenue'],
            'conversion_rate': self.metrics['conversions'] / max(active_users, 1) * 100
        }

        print(f"""
╔══════════════════════════════════════╗
║  Real-Time Analytics Dashboard       ║
╠══════════════════════════════════════╣
║  Active Users: {active_users:20} ║
║  Page Views: {total_page_views:22} ║
║  Conversions: {self.metrics['conversions']:21} ║
║  Revenue: ${self.metrics['revenue']:23.2f} ║
║  Conv Rate: {window_metrics['conversion_rate']:21.2f}% ║
╚══════════════════════════════════════╝
        """)

        # Forward to real-time dashboard (WebSocket, Redis, etc.)
        # Forward to Spark for deeper analysis

        # Reset window metrics
        self.metrics['page_views'].clear()
        self.metrics['conversions'] = 0
        self.metrics['revenue'] = 0.0

    def process_batch(self, batch):
        """Process batch for ML models and predictions"""
        # Extract features for ML
        user_behaviors = defaultdict(list)
        for msg in batch:
            event = msg.value
            user_behaviors[event['user_id']].append(event)

        # Run prediction models
        for user_id, events in user_behaviors.items():
            if len(events) >= 5:
                churn_risk = self.predict_churn_risk(events)
                if churn_risk > 0.7:
                    self.trigger_retention_campaign(user_id, churn_risk)

    def predict_churn_risk(self, events):
        """Simple churn prediction based on user behavior"""
        # Check for decreased engagement signals
        recent_activity = [e for e in events if time.time() - e['timestamp'] < 3600]
        return max(0, 1 - (len(recent_activity) / 10))

    def trigger_retention_campaign(self, user_id, risk_score):
        print(f"🎯 High churn risk detected: User {user_id} ({risk_score:.2%})")
        # Trigger personalized retention campaign

    def trigger_anomaly_alert(self, event):
        print(f"⚠️ Anomaly detected: {event['event_type']} from {event['user_id']}")

class AnomalyDetector:
    def __init__(self):
        self.baseline = defaultdict(lambda: {'count': 0, 'avg_interval': 0})

    def is_anomaly(self, event):
        """Detect anomalous behavior patterns"""
        key = f"{event['user_id']}:{event['event_type']}"
        # Simple anomaly detection based on frequency
        return random.random() < 0.01  # 1% anomaly rate for demo

# Usage: Real-time tracking and analytics
tracker = WebAnalyticsTracker(['localhost:9092'])

# Simulate user activity
for i in range(1000):
    user_id = f"user_{random.randint(1, 100)}"
    tracker.track_page_view(user_id, f'/page/{random.randint(1, 20)}',
                           f'Page {i}', user_agent='Chrome/90.0')

    if random.random() < 0.3:
        tracker.track_click(user_id, f'btn_{i}', 'Click Me')

    if random.random() < 0.05:
        tracker.track_purchase(user_id, f'order_{i}',
                              [{'product': 'Item', 'qty': 1}],
                              random.uniform(10, 500))

# Start analytics engine
engine = RealTimeAnalyticsEngine(['localhost:9092'])
engine.process_events()
```

---

### 5. Data Replication

**Definition:** Replicating data between different databases, data centers, or systems through Kafka Connect or custom Change Data Capture (CDC), ensuring data consistency across distributed environments.

**Purpose:**

- Maintain data consistency across regions
- Enable disaster recovery
- Support read scaling with replicas
- Facilitate data migration
- Implement CQRS (Command Query Responsibility Segregation)

**Key Benefits:**

- **Eventually Consistent**: Changes propagate to all replicas
- **Conflict Resolution**: Handle concurrent updates intelligently
- **Audit Trail**: Track all data changes
- **Zero Downtime**: Replicate without downtime

**Common Scenarios:**

- Multi-region database synchronization
- Database migration (MySQL → PostgreSQL)
- Data warehouse ETL
- Cache invalidation
- Microservices data sharing
- GDPR data replication

**Replication Strategies:**

- **Last-Write-Wins**: Use timestamps to resolve conflicts
- **Field-Level Merge**: Merge non-conflicting fields
- **Custom Business Logic**: Application-specific conflict resolution
- **Manual Resolution**: Queue conflicts for human review

**Architecture:**

- Source DB → CDC Producer → Kafka → Replication Consumer → Target DB
- Supports bidirectional replication with conflict detection

```python
# Example: Multi-Region Database Replication with Conflict Resolution
from kafka import KafkaProducer, KafkaConsumer
from kafka.admin import KafkaAdminClient, NewTopic
import json
import time
from datetime import datetime
from enum import Enum
import hashlib

class OperationType(Enum):
    INSERT = 'INSERT'
    UPDATE = 'UPDATE'
    DELETE = 'DELETE'
    TRUNCATE = 'TRUNCATE'

class DatabaseCDCProducer:
    """Change Data Capture producer for database replication"""

    def __init__(self, bootstrap_servers, source_db_name, region):
        self.source_db = source_db_name
        self.region = region
        self.producer = KafkaProducer(
            bootstrap_servers=bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            key_serializer=lambda k: k.encode('utf-8'),
            acks='all',
            retries=10,
            max_in_flight_requests_per_connection=1,  # Maintain order
            enable_idempotence=True,
            compression_type='snappy'
        )
        self.sequence_num = 0

    def capture_change(self, operation, table, record_id, before_data, after_data):
        """Capture database change event"""
        self.sequence_num += 1

        change_event = {
            'event_id': self._generate_event_id(),
            'sequence_num': self.sequence_num,
            'timestamp': time.time(),
            'source_db': self.source_db,
            'region': self.region,
            'operation': operation.value,
            'table': table,
            'record_id': record_id,
            'before': before_data,
            'after': after_data,
            'metadata': {
                'transaction_id': self._get_transaction_id(),
                'schema_version': '1.0',
                'captured_at': datetime.utcnow().isoformat()
            }
        }

        # Use table:record_id as key for partitioning consistency
        partition_key = f"{table}:{record_id}"

        # Send to region-specific topic
        topic = f'db-changes-{self.region}'
        future = self.producer.send(topic, key=partition_key, value=change_event)

        # Also send to global replication topic
        self.producer.send('db-changes-global', key=partition_key, value=change_event)

        return future

    def _generate_event_id(self):
        """Generate unique event ID"""
        data = f"{self.source_db}:{self.region}:{time.time()}:{self.sequence_num}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]

    def _get_transaction_id(self):
        """Get current database transaction ID"""
        return f"txn_{int(time.time() * 1000)}"

    def capture_bulk_insert(self, table, records):
        """Capture bulk insert operation"""
        for record in records:
            self.capture_change(
                OperationType.INSERT,
                table,
                record['id'],
                before_data=None,
                after_data=record
            )

class DatabaseReplicationConsumer:
    """Consumer that applies changes to target database"""

    def __init__(self, bootstrap_servers, target_db_name, region):
        self.target_db = target_db_name
        self.region = region
        self.consumer = KafkaConsumer(
            'db-changes-global',
            bootstrap_servers=bootstrap_servers,
            group_id=f'db-replicator-{region}',
            auto_offset_reset='earliest',
            enable_auto_commit=False,
            max_poll_records=100,
            value_deserializer=lambda m: json.loads(m.decode('utf-8'))
        )

        # Track processed events to handle duplicates
        self.processed_events = set()
        self.conflict_resolver = ConflictResolver()
        self.replication_lag = {}

    def start_replication(self):
        """Start continuous replication process"""
        batch = []
        stats = {'replicated': 0, 'conflicts': 0, 'errors': 0}

        for message in self.consumer:
            change_event = message.value
            batch.append(message)

            # Skip if already processed (idempotency)
            if change_event['event_id'] in self.processed_events:
                continue

            # Skip changes from same region to avoid loops
            if change_event['region'] == self.region:
                continue

            try:
                # Check for conflicts
                conflict = self.detect_conflict(change_event)

                if conflict:
                    resolved_event = self.conflict_resolver.resolve(change_event, conflict)
                    self.apply_change(resolved_event)
                    stats['conflicts'] += 1
                else:
                    self.apply_change(change_event)

                self.processed_events.add(change_event['event_id'])
                stats['replicated'] += 1

                # Track replication lag
                lag = time.time() - change_event['timestamp']
                self.replication_lag[change_event['table']] = lag

            except Exception as e:
                print(f"❌ Replication error: {e}")
                self.handle_replication_error(change_event, e)
                stats['errors'] += 1

            # Commit in batches
            if len(batch) >= 100:
                self.consumer.commit()
                self.report_stats(stats)
                batch = []

    def detect_conflict(self, change_event):
        """Detect replication conflicts"""
        # Simulate conflict detection (e.g., concurrent updates)
        table = change_event['table']
        record_id = change_event['record_id']

        # Check if record was modified locally after source change
        local_record = self.fetch_local_record(table, record_id)

        if local_record and change_event['operation'] == 'UPDATE':
            local_timestamp = local_record.get('updated_at', 0)
            source_timestamp = change_event['timestamp']

            if local_timestamp > source_timestamp:
                return {
                    'type': 'CONCURRENT_UPDATE',
                    'local_data': local_record,
                    'remote_data': change_event['after']
                }

        return None

    def apply_change(self, change_event):
        """Apply change to target database"""
        operation = change_event['operation']
        table = change_event['table']
        record_id = change_event['record_id']

        if operation == 'INSERT':
            self.db_insert(table, change_event['after'])
            print(f"✓ Replicated INSERT: {table}:{record_id}")

        elif operation == 'UPDATE':
            self.db_update(table, record_id, change_event['after'])
            print(f"✓ Replicated UPDATE: {table}:{record_id}")

        elif operation == 'DELETE':
            self.db_delete(table, record_id)
            print(f"✓ Replicated DELETE: {table}:{record_id}")

    def fetch_local_record(self, table, record_id):
        """Fetch record from local database"""
        # Simulate database query
        return {'id': record_id, 'updated_at': time.time() - random.uniform(0, 100)}

    def db_insert(self, table, data):
        """Insert into target database"""
        # Simulate database insert
        pass

    def db_update(self, table, record_id, data):
        """Update in target database"""
        # Simulate database update
        pass

    def db_delete(self, table, record_id):
        """Delete from target database"""
        # Simulate database delete
        pass

    def handle_replication_error(self, change_event, error):
        """Handle replication errors with DLQ"""
        error_record = {
            **change_event,
            'error': str(error),
            'failed_at': time.time(),
            'target_db': self.target_db,
            'region': self.region
        }
        # Send to dead letter queue for manual review
        print(f"⚠️ Sending to DLQ: {change_event['table']}:{change_event['record_id']}")

    def report_stats(self, stats):
        """Report replication statistics"""
        avg_lag = sum(self.replication_lag.values()) / len(self.replication_lag) if self.replication_lag else 0

        print(f"""
╔════════════════════════════════════════════╗
║     Replication Statistics - {self.region}     ║
╠════════════════════════════════════════════╣
║  Replicated: {stats['replicated']:27} ║
║  Conflicts Resolved: {stats['conflicts']:19} ║
║  Errors: {stats['errors']:31} ║
║  Avg Replication Lag: {avg_lag:18.2f}s ║
╚════════════════════════════════════════════╝
        """)

class ConflictResolver:
    """Resolve replication conflicts using different strategies"""

    def resolve(self, remote_change, conflict):
        """Resolve conflict using configured strategy"""
        conflict_type = conflict['type']

        if conflict_type == 'CONCURRENT_UPDATE':
            return self.resolve_concurrent_update(remote_change, conflict)

        return remote_change

    def resolve_concurrent_update(self, remote_change, conflict):
        """Resolve concurrent update conflicts"""
        # Strategy 1: Last-Write-Wins (timestamp-based)
        local_data = conflict['local_data']
        remote_data = conflict['remote_data']

        # Compare timestamps
        if local_data.get('updated_at', 0) > remote_change['timestamp']:
            print(f"⚡ Conflict: Local wins (newer timestamp)")
            return None  # Keep local changes
        else:
            print(f"⚡ Conflict: Remote wins (newer timestamp)")
            return remote_change

        # Strategy 2: Field-level merge (merge non-conflicting fields)
        # Strategy 3: Custom business logic
        # Strategy 4: Manual resolution queue

class BidirectionalReplicator:
    """Bidirectional replication between multiple regions"""

    def __init__(self, bootstrap_servers, regions):
        self.regions = regions
        self.producers = {}
        self.consumers = {}

        for region in regions:
            self.producers[region] = DatabaseCDCProducer(
                bootstrap_servers, f'db-{region}', region
            )
            self.consumers[region] = DatabaseReplicationConsumer(
                bootstrap_servers, f'db-{region}', region
            )

    def setup_topology(self):
        """Setup multi-region replication topology"""
        print("""
        Replication Topology:

        US-East ←→ Kafka ←→ EU-West
           ↓                    ↓
        US-West              APAC
        """)

    def start_all_replicators(self):
        """Start all region replicators"""
        import threading

        threads = []
        for region, consumer in self.consumers.items():
            thread = threading.Thread(
                target=consumer.start_replication,
                daemon=True,
                name=f"Replicator-{region}"
            )
            thread.start()
            threads.append(thread)

        return threads

# Usage: Multi-region database replication
regions = ['us-east', 'us-west', 'eu-west', 'apac']
replicator = BidirectionalReplicator(['localhost:9092'], regions)
replicator.setup_topology()

# Simulate database changes in US-East
us_producer = replicator.producers['us-east']

# Simulate various database operations
for i in range(50):
    # INSERT
    us_producer.capture_change(
        OperationType.INSERT,
        table='users',
        record_id=f'user_{i}',
        before_data=None,
        after_data={
            'id': f'user_{i}',
            'name': f'User {i}',
            'email': f'user{i}@example.com',
            'created_at': time.time()
        }
    )

    # UPDATE
    if i % 3 == 0:
        us_producer.capture_change(
            OperationType.UPDATE,
            table='users',
            record_id=f'user_{i}',
            before_data={'name': f'User {i}'},
            after_data={'name': f'Updated User {i}', 'updated_at': time.time()}
        )

    time.sleep(0.1)

# Start replication to all regions
threads = replicator.start_all_replicators()
```

---

## Common Issues and Troubleshooting

### Connection Issues

**Symptoms**: Cannot connect to Kafka brokers, timeout errors

**Solutions**:

- Check `bootstrap_servers` format: `['host1:9092', 'host2:9092']`
- Verify network connectivity: `telnet hostname 9092`
- Check firewall rules and security groups
- Ensure broker is running: `ps aux | grep kafka`

### Offset Issues

**Symptoms**: Consumer skips messages or re-processes old messages

**Solutions**:

- Use `auto_offset_reset='earliest'` to handle missing offsets
- Check offset commits are working: `enable_auto_commit=True`
- Verify consumer group has correct offsets
- Reset offsets if corrupted: `kafka-consumer-groups --reset-offsets`

### Timeout Issues

**Symptoms**: Producer send timeouts, consumer poll timeouts

**Solutions**:

- Increase `request_timeout_ms` (default: 30000)
- Increase `session_timeout_ms` for consumers (default: 10000)
- Check broker health and resource usage
- Reduce `max_poll_records` if processing is slow
- Increase broker capacity if overloaded

### Memory Issues

**Symptoms**: OutOfMemory errors, garbage collection pauses

**Solutions**:

- Adjust producer `buffer_memory` (default: 33554432 = 32MB)
- Reduce consumer `max_poll_records` (default: 500)
- Enable compression to reduce memory usage
- Increase JVM heap size for application
- Monitor memory usage and tune accordingly

### Rebalancing Issues

**Symptoms**: Frequent consumer rebalances, processing interruptions

**Solutions**:

- Tune `session_timeout_ms` (higher = less sensitive to delays)
- Tune `heartbeat_interval_ms` (lower = more frequent heartbeats)
- Reduce `max_poll_interval_ms` if processing is fast
- Increase `max_poll_interval_ms` if processing is slow
- Avoid long-running processing in poll loop
- Monitor rebalance frequency and duration

### Message Loss

**Symptoms**: Messages appear to be missing

**Solutions**:

- Use `acks='all'` for producers
- Set `min.insync.replicas=2` on broker
- Enable `enable_idempotence=True` for producers
- Commit offsets only after successful processing
- Verify replication factor ≥ 2

### Duplicate Messages

**Symptoms**: Same message processed multiple times

**Solutions**:

- Implement idempotent processing (track message IDs)
- Use manual offset commits after processing
- Enable producer idempotence: `enable_idempotence=True`
- Set `max_in_flight_requests_per_connection=1` for ordering

---

## Glossary

**Broker**: A Kafka server that stores and serves data

**Topic**: A category/feed name for messages (like a database table)

**Partition**: An ordered, immutable sequence of messages (like a log file)

**Offset**: A unique identifier for each message within a partition

**Producer**: Client that publishes messages to topics

**Consumer**: Client that subscribes to topics and processes messages

**Consumer Group**: Set of consumers that coordinate to consume a topic

**Replication**: Copying partitions across multiple brokers for fault tolerance

**Leader**: The broker responsible for all reads/writes for a partition

**Follower**: Broker that replicates the leader's partition data

**ISR (In-Sync Replicas)**: Replicas that are caught up with the leader

**Lag**: Difference between latest offset and consumer's current position

**Retention**: How long Kafka keeps messages (time or size-based)

**Compaction**: Keeping only the latest value for each key

**Coordinator**: Broker that manages consumer group membership

**Rebalance**: Redistribution of partitions among consumers in a group

---

## Additional Resources

- **Official Documentation**: https://kafka.apache.org/documentation/
- **kafka-python Docs**: https://kafka-python.readthedocs.io/
- **Confluent Platform**: https://docs.confluent.io/
- **Best Practices**: https://kafka.apache.org/documentation/#bestpractices

---
