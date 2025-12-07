# Input Variables
variable "replicas" {
  description = "Number of Apache replicas"
  type        = number
  default     = 3
}

variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
  default     = "mau-menang"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "apache-webserver"
}

variable "service_port" {
  description = "Service port"
  type        = number
  default     = 30090
}