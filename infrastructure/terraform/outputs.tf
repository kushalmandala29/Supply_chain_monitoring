# ==============================================================================
# Terraform Outputs — Exported Resource ARNs & Endpoints
# ==============================================================================

output "sqs_queue_url" {
  description = "SQS FIFO queue URL for swarm task dispatch"
  value       = aws_sqs_queue.swarm_task_queue.url
}

output "sqs_queue_arn" {
  description = "SQS FIFO queue ARN"
  value       = aws_sqs_queue.swarm_task_queue.arn
}

output "dynamodb_table_name" {
  description = "DynamoDB table name for swarm session memory"
  value       = aws_dynamodb_table.swarm_session_memory.name
}

output "dynamodb_table_arn" {
  description = "DynamoDB table ARN"
  value       = aws_dynamodb_table.swarm_session_memory.arn
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint address"
  value       = aws_db_instance.analytics_db.address
}

output "rds_port" {
  description = "RDS PostgreSQL port"
  value       = aws_db_instance.analytics_db.port
}

output "lambda_rss_arn" {
  description = "RSS ingestion Lambda function ARN"
  value       = aws_lambda_function.rss_ingest_processor.arn
}

output "lambda_commodity_arn" {
  description = "Commodity ETL Lambda function ARN"
  value       = aws_lambda_function.commodity_etl_processor.arn
}

output "lambda_satellite_arn" {
  description = "Satellite ingest Lambda function ARN"
  value       = aws_lambda_function.satellite_ingest_processor.arn
}
