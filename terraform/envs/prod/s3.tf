# jaetill-portal S3 bucket — hosts the SPA at jaetill.com / www.jaetill.com.
# Origin for CloudFront distribution E3L96MPPOA7GTI.

resource "aws_s3_bucket" "main" {
  bucket = "jaetill-portal"
}

resource "aws_s3_bucket_policy" "main" {
  bucket = aws_s3_bucket.main.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOACRead"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.main.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = "arn:aws:cloudfront::${var.aws_account_id}:distribution/E3L96MPPOA7GTI"
          }
        }
      }
    ]
  })
}