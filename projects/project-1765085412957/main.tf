# Nginx Web Server Deployment
resource "kubernetes_deployment" "nginx" {
  metadata {
    name      = "nginx-webserver"
    namespace = "mau-menang"
    labels = {
      app = "nginx-webserver"
    }
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        app = "nginx-webserver"
      }
    }

    template {
      metadata {
        labels = {
          app = "nginx-webserver"
        }
      }

      spec {
        container {
          image = "nginx:alpine"
          name  = "nginx"

          port {
            container_port = 80
            name           = "http"
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

resource "kubernetes_service" "nginx" {
  metadata {
    name      = "nginx-service"
    namespace = "mau-menang"
    labels = {
      app = "nginx-webserver"
    }
  }

  spec {
    selector = {
      app = "nginx-webserver"
    }

    port {
      port        = 80
      target_port = 80
      protocol    = "TCP"
    }

    type = "NodePort"
  }
}