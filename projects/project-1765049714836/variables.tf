# Input Variables
variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
  default     = "mau-menang"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "phpmyadmin"
}

variable "service_port" {
  description = "Service port"
  type        = number
  default     = 30091
}

variable "mysql_host" {
  description = "MySQL server host"
  type        = string
  default     = "mysql-service"
}

variable "mysql_port" {
  description = "MySQL server port"
  type        = number
  default     = 3306
}