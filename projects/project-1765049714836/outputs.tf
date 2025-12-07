# Output Values
output "deployment_name" {
  description = "Name of the phpMyAdmin deployment"
  value       = kubernetes_deployment.phpmyadmin.metadata[0].name
}

output "service_name" {
  description = "Name of the phpMyAdmin service"
  value       = kubernetes_service.phpmyadmin.metadata[0].name
}

output "service_port" {
  description = "Port where phpMyAdmin is accessible"
  value       = kubernetes_service.phpmyadmin.spec[0].port[0].port
}

output "namespace" {
  description = "Namespace where resources are deployed"
  value       = var.namespace
}

output "mysql_host" {
  description = "Configured MySQL host"
  value       = var.mysql_host
}