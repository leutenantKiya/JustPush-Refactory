# Redis Cache Deployment
resource "kubernetes_deployment" "redis" {
  metadata {
    name      = "redis-cache"
    namespace = "mau-menang"
    labels = {
      app = "redis-cache"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "redis-cache"
      }
    }

    template {
      metadata {
        labels = {
          app = "redis-cache"
        }
      }

      spec {
        container {
          image = "redis:alpine"
          name  = "redis"

          port {
            container_port = 6379
            name           = "redis"
          }

          resources {
            limits = {
              cpu    = "200m"
              memory = "256Mi"
            }
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
          }

          liveness_probe {
            exec {
              command = ["redis-cli", "ping"]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            exec {
              command = ["redis-cli", "ping"]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "redis" {
  metadata {
    name      = "redis-service"
    namespace = "mau-menang"
    labels = {
      app = "redis-cache"
    }
  }

  spec {
    selector = {
      app = "redis-cache"
    }

    port {
      port        = 6379
      target_port = 6379
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}