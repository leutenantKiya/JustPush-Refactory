# phpMyAdmin Deployment
resource "kubernetes_deployment" "phpmyadmin" {
  metadata {
    name      = var.app_name
    namespace = var.namespace
    labels = {
      app = var.app_name
    }
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        app = var.app_name
      }
    }

    template {
      metadata {
        labels = {
          app = var.app_name
        }
      }

      spec {
        container {
          image = "phpmyadmin/phpmyadmin:latest"
          name  = "phpmyadmin"

          port {
            container_port = 80
            name           = "http"
          }

          env {
            name  = "PMA_HOST"
            value = var.mysql_host
          }

          env {
            name  = "PMA_PORT"
            value = var.mysql_port
          }

          env {
            name  = "PMA_USER"
            value = "root"
          }

          env {
            name  = "PMA_PASSWORD"
            value = "ukdwseru"
          }

          env {
            name = "PMA_ARBITRARY"
            value = 1
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
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
      }
    }
  }
}

# phpMyAdmin Service
resource "kubernetes_service" "phpmyadmin" {
  metadata {
    name      = "${var.app_name}-service"
    namespace = var.namespace
    labels = {
      app = var.app_name
    }
  }

  spec {
    selector = {
      app = var.app_name
    }

    port {
      port        = var.service_port
      target_port = 80
      protocol    = "TCP"
    }

    type = "NodePort"
  }
}