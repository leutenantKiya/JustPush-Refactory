# Output Values
output "deployment_name" {
  description = "Name of the Apache deployment"
  value       = kubernetes_deployment.apache.metadata[0].name
}

output "service_name" {
  description = "Name of the Apache service"
  value       = kubernetes_service.apache.metadata[0].name
}

output "service_port" {
  description = "Port where Apache is accessible"
  value       = kubernetes_service.apache.spec[0].port[0].port
}

output "namespace" {
  description = "Namespace where resources are deployed"
  value       = var.namespace
}

output "replicas" {
  description = "Number of Apache replicas"
  value       = var.replicas
}