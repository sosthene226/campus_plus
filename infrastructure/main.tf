# Configuration Terraform pour CAMPUS+

# Configuration du provider AWS
provider "aws" {
  region = "eu-west-3"  # Paris
  profile = "campus-plus"
}

# VPC Principal
resource "aws_vpc" "campus_plus_vpc" {
  cidr_block = "10.0.0.0/16"
  
  tags = {
    Name = "CAMPUS+ VPC"
    Environment = "Production"
  }
}

# Sous-réseaux
resource "aws_subnet" "public_subnets" {
  count             = 2
  vpc_id            = aws_vpc.campus_plus_vpc.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = "eu-west-3${count.index == 0 ? "a" : "b"}"
  
  tags = {
    Name = "Public Subnet ${count.index + 1}"
  }
}

# Groupe de sécurité pour l'application
resource "aws_security_group" "campus_plus_sg" {
  name        = "campus-plus-security-group"
  description = "Sécurité pour l'application CAMPUS+"
  vpc_id      = aws_vpc.campus_plus_vpc.id

  # Règles d'entrée
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Règles de sortie
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Instance Elastic Beanstalk
resource "aws_elastic_beanstalk_application" "campus_plus_app" {
  name        = "campus-plus-application"
  description = "Application CAMPUS+ déployée sur Elastic Beanstalk"
}

resource "aws_elastic_beanstalk_environment" "campus_plus_env" {
  name                = "campus-plus-production"
  application         = aws_elastic_beanstalk_application.campus_plus_app.name
  solution_stack_name = "64bit Amazon Linux 2 v5.8.0 running Node.js 18"

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "SecurityGroups"
    value     = aws_security_group.campus_plus_sg.id
  }

  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "EnvironmentType"
    value     = "LoadBalanced"
  }
}

# Configuration CloudFront
resource "aws_cloudfront_distribution" "campus_plus_cdn" {
  enabled             = true
  default_root_object = "index.html"

  origin {
    domain_name = aws_elastic_beanstalk_environment.campus_plus_env.cname
    origin_id   = "campus-plus-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "campus-plus-origin"

    forwarded_values {
      query_string = true
      headers      = ["Origin"]

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# Configuration DocumentDB
resource "aws_docdb_cluster" "campus_plus_db" {
  cluster_identifier      = "campus-plus-cluster"
  engine                  = "docdb"
  master_username         = var.db_username
  master_password         = var.db_password
  backup_retention_period = 5
  preferred_backup_window = "07:00-09:00"
  skip_final_snapshot     = true
}

# Variables sensibles
variable "db_username" {
  description = "Nom d'utilisateur de la base de données"
  type        = string
}

variable "db_password" {
  description = "Mot de passe de la base de données"
  type        = string
  sensitive   = true
}

# Outputs
output "application_url" {
  value = aws_elastic_beanstalk_environment.campus_plus_env.cname
}

output "cdn_domain_name" {
  value = aws_cloudfront_distribution.campus_plus_cdn.domain_name
}
