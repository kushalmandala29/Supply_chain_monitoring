# ==============================================================================
# Multi-Agent Supply Chain Risk Intelligence System — AWS Infrastructure
# Terraform IaC (v8.0)
# ==============================================================================
# Provisions: SQS FIFO Queue, DynamoDB Table, RDS PostgreSQL+PostGIS,
#             Lambda Functions, EventBridge Cron Triggers
# Target: AWS Free-Tier resource allocations
# ==============================================================================

provider "aws" {
  region = var.aws_region
}

# ------------------------------------------------------------------------------
# 1. Durability Layer: Amazon SQS (Task Queue Buffer)
# ------------------------------------------------------------------------------
resource "aws_sqs_queue" "swarm_task_queue" {
  name                        = "supply-chain-swarm-tasks.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = 86400  # 24 hours
  receive_wait_time_seconds   = 20     # Long polling
  visibility_timeout_seconds  = 120    # 2 min processing window

  tags = {
    Project     = "supply-chain-risk-intelligence"
    Environment = var.environment
  }
}

# ------------------------------------------------------------------------------
# 2. Ephemeral Working Memory: Amazon DynamoDB
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "swarm_session_memory" {
  name         = "supply-chain-swarm-memory"
  billing_mode = "PROVISIONED"
  read_capacity  = 5  # Free-tier: 25 RCU
  write_capacity = 5  # Free-tier: 25 WCU
  hash_key     = "thread_id"
  range_key    = "checkpoint_id"

  attribute {
    name = "thread_id"
    type = "S"
  }

  attribute {
    name = "checkpoint_id"
    type = "S"
  }

  ttl {
    attribute_name = "ttl_expiry"
    enabled        = true
  }

  tags = {
    Project     = "supply-chain-risk-intelligence"
    Environment = var.environment
  }
}

# ------------------------------------------------------------------------------
# 3. Persistent Analytics Memory: Amazon RDS (PostgreSQL + PostGIS)
# ------------------------------------------------------------------------------
resource "aws_db_subnet_group" "rds_subnets" {
  name       = "supply-chain-rds-subnets"
  subnet_ids = var.rds_subnet_ids

  tags = {
    Project = "supply-chain-risk-intelligence"
  }
}

resource "aws_security_group" "rds_sg" {
  name        = "supply-chain-rds-sg"
  description = "Allow inbound PostgreSQL from authorized edge nodes"
  vpc_id      = var.vpc_id

  ingress {
    description = "PostgreSQL from authorized CIDR"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.rds_allowed_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Project     = "supply-chain-risk-intelligence"
    Environment = var.environment
  }
}

resource "aws_db_instance" "analytics_db" {
  identifier             = "supply-chain-analytics-rds"
  allocated_storage      = 20       # Free-tier: 20 GB
  max_allocated_storage  = 20
  engine                 = "postgres"
  engine_version         = "15.4"
  instance_class         = "db.t3.micro"  # Free-tier eligible
  db_name                = var.rds_db_name
  username               = var.rds_username
  password               = var.rds_password
  db_subnet_group_name   = aws_db_subnet_group.rds_subnets.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  publicly_accessible    = var.rds_publicly_accessible
  skip_final_snapshot    = true
  storage_encrypted      = true

  tags = {
    Project     = "supply-chain-risk-intelligence"
    Environment = var.environment
  }
}

# ------------------------------------------------------------------------------
# 4. IAM Roles & Policies for Lambda Functions
# ------------------------------------------------------------------------------
resource "aws_iam_role" "lambda_exec_role" {
  name = "supply-chain-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = {
    Project = "supply-chain-risk-intelligence"
  }
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "lambda_sqs_rds_policy" {
  name = "supply-chain-lambda-permissions"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowSQSSend"
        Action   = ["sqs:SendMessage"]
        Effect   = "Allow"
        Resource = aws_sqs_queue.swarm_task_queue.arn
      },
      {
        Sid      = "AllowDynamoDBAccess"
        Action   = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ]
        Effect   = "Allow"
        Resource = aws_dynamodb_table.swarm_session_memory.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_custom_policy" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = aws_iam_policy.lambda_sqs_rds_policy.arn
}

# ------------------------------------------------------------------------------
# 5. Continuous Ingestion Compute: AWS Lambda Functions
# ------------------------------------------------------------------------------

# RSS / GDELT Feed Processor (5-minute cron)
resource "aws_lambda_function" "rss_ingest_processor" {
  filename      = "../../lambdas/rss_ingest/package.zip"
  function_name = "supply-chain-rss-ingest"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "index.lambda_handler"
  runtime       = "python3.11"
  timeout       = 30
  memory_size   = 256

  environment {
    variables = {
      SQS_QUEUE_URL = aws_sqs_queue.swarm_task_queue.url
    }
  }

  tags = {
    Project     = "supply-chain-risk-intelligence"
    Environment = var.environment
    Agent       = "ingestion-rss"
  }
}

# Commodity Price ETL (Hourly cron)
resource "aws_lambda_function" "commodity_etl_processor" {
  filename      = "../../lambdas/commodity_etl/package.zip"
  function_name = "supply-chain-commodity-etl"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "index.lambda_handler"
  runtime       = "python3.11"
  timeout       = 60
  memory_size   = 256

  environment {
    variables = {
      SQS_QUEUE_URL         = aws_sqs_queue.swarm_task_queue.url
      ZSCORE_THRESHOLD      = var.zscore_anomaly_threshold
      POSTGRES_HOST         = aws_db_instance.analytics_db.address
      POSTGRES_DB           = var.rds_db_name
    }
  }

  tags = {
    Project     = "supply-chain-risk-intelligence"
    Environment = var.environment
    Agent       = "ingestion-commodity"
  }
}

# Satellite / AIS Feed Processor
resource "aws_lambda_function" "satellite_ingest_processor" {
  filename      = "../../lambdas/satellite_ingest/package.zip"
  function_name = "supply-chain-satellite-ingest"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "index.lambda_handler"
  runtime       = "python3.11"
  timeout       = 45
  memory_size   = 512

  environment {
    variables = {
      SQS_QUEUE_URL = aws_sqs_queue.swarm_task_queue.url
    }
  }

  tags = {
    Project     = "supply-chain-risk-intelligence"
    Environment = var.environment
    Agent       = "ingestion-satellite"
  }
}

# ------------------------------------------------------------------------------
# 6. Automated Scheduling Engine: AWS EventBridge (Cron Triggers)
# ------------------------------------------------------------------------------

# RSS Feed: Every 5 minutes
resource "aws_cloudwatch_event_rule" "rss_five_minute_cron" {
  name                = "supply-chain-rss-poll-trigger"
  description         = "Triggers RSS/GDELT normalization Lambda every 5 minutes"
  schedule_expression = "cron(*/5 * * * ? *)"
}

resource "aws_cloudwatch_event_target" "rss_lambda_target" {
  rule      = aws_cloudwatch_event_rule.rss_five_minute_cron.name
  target_id = "TriggerRSSLambda"
  arn       = aws_lambda_function.rss_ingest_processor.arn
}

resource "aws_lambda_permission" "allow_eventbridge_rss" {
  statement_id  = "AllowExecutionFromEventBridge-RSS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.rss_ingest_processor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.rss_five_minute_cron.arn
}

# Commodity ETL: Every hour
resource "aws_cloudwatch_event_rule" "commodity_hourly_cron" {
  name                = "supply-chain-commodity-etl-trigger"
  description         = "Triggers commodity price ETL Lambda every hour"
  schedule_expression = "cron(0 * * * ? *)"
}

resource "aws_cloudwatch_event_target" "commodity_lambda_target" {
  rule      = aws_cloudwatch_event_rule.commodity_hourly_cron.name
  target_id = "TriggerCommodityLambda"
  arn       = aws_lambda_function.commodity_etl_processor.arn
}

resource "aws_lambda_permission" "allow_eventbridge_commodity" {
  statement_id  = "AllowExecutionFromEventBridge-Commodity"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.commodity_etl_processor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.commodity_hourly_cron.arn
}

# Satellite AIS: Every 15 minutes
resource "aws_cloudwatch_event_rule" "satellite_fifteen_minute_cron" {
  name                = "supply-chain-satellite-poll-trigger"
  description         = "Triggers satellite AIS ingest Lambda every 15 minutes"
  schedule_expression = "cron(*/15 * * * ? *)"
}

resource "aws_cloudwatch_event_target" "satellite_lambda_target" {
  rule      = aws_cloudwatch_event_rule.satellite_fifteen_minute_cron.name
  target_id = "TriggerSatelliteLambda"
  arn       = aws_lambda_function.satellite_ingest_processor.arn
}

resource "aws_lambda_permission" "allow_eventbridge_satellite" {
  statement_id  = "AllowExecutionFromEventBridge-Satellite"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.satellite_ingest_processor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.satellite_fifteen_minute_cron.arn
}
