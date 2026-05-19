# REST API: jaetill-portal-api (eqidhh18u2)

resource "aws_api_gateway_rest_api" "jp_rest" {
  name             = "jaetill-portal-api"
  api_key_source   = "HEADER"
  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_authorizer" "jp_rest_jaetill_cognito" {
  name            = "jaetill-cognito"
  rest_api_id     = aws_api_gateway_rest_api.jp_rest.id
  type            = "COGNITO_USER_POOLS"
  provider_arns   = ["arn:aws:cognito-idp:us-east-2:214599503944:userpool/us-east-2_xneeJzaDJ"]
  identity_source = "method.request.header.Authorization"
}

resource "aws_api_gateway_resource" "jp_rest_invite" {
  rest_api_id = aws_api_gateway_rest_api.jp_rest.id
  parent_id   = aws_api_gateway_rest_api.jp_rest.root_resource_id
  path_part   = "invite"
}

resource "aws_api_gateway_method" "jp_rest_invite_get" {
  rest_api_id      = aws_api_gateway_rest_api.jp_rest.id
  resource_id      = aws_api_gateway_resource.jp_rest_invite.id
  http_method      = "GET"
  authorization    = "COGNITO_USER_POOLS"
  authorizer_id    = aws_api_gateway_authorizer.jp_rest_jaetill_cognito.id
  api_key_required = false
}

resource "aws_api_gateway_integration" "jp_rest_invite_get" {
  rest_api_id          = aws_api_gateway_rest_api.jp_rest.id
  resource_id          = aws_api_gateway_resource.jp_rest_invite.id
  http_method          = aws_api_gateway_method.jp_rest_invite_get.http_method
  type                 = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:us-east-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-2:214599503944:function:jaetill-portal-invite/invocations"
  integration_http_method = "POST"
  passthrough_behavior = "WHEN_NO_MATCH"
  timeout_milliseconds = 29000
  cache_namespace      = "vkobgn"
  cache_key_parameters = []
}

resource "aws_api_gateway_method" "jp_rest_invite_options" {
  rest_api_id      = aws_api_gateway_rest_api.jp_rest.id
  resource_id      = aws_api_gateway_resource.jp_rest_invite.id
  http_method      = "OPTIONS"
  authorization    = "NONE"
  api_key_required = false
}

resource "aws_api_gateway_integration" "jp_rest_invite_options" {
  rest_api_id          = aws_api_gateway_rest_api.jp_rest.id
  resource_id          = aws_api_gateway_resource.jp_rest_invite.id
  http_method          = aws_api_gateway_method.jp_rest_invite_options.http_method
  type                 = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:us-east-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-2:214599503944:function:jaetill-portal-invite/invocations"
  integration_http_method = "POST"
  passthrough_behavior = "WHEN_NO_MATCH"
  timeout_milliseconds = 29000
  cache_namespace      = "vkobgn"
  cache_key_parameters = []
}

resource "aws_api_gateway_method" "jp_rest_invite_post" {
  rest_api_id      = aws_api_gateway_rest_api.jp_rest.id
  resource_id      = aws_api_gateway_resource.jp_rest_invite.id
  http_method      = "POST"
  authorization    = "COGNITO_USER_POOLS"
  authorizer_id    = aws_api_gateway_authorizer.jp_rest_jaetill_cognito.id
  api_key_required = false
}

resource "aws_api_gateway_integration" "jp_rest_invite_post" {
  rest_api_id          = aws_api_gateway_rest_api.jp_rest.id
  resource_id          = aws_api_gateway_resource.jp_rest_invite.id
  http_method          = aws_api_gateway_method.jp_rest_invite_post.http_method
  type                 = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:us-east-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-2:214599503944:function:jaetill-portal-invite/invocations"
  integration_http_method = "POST"
  passthrough_behavior = "WHEN_NO_MATCH"
  timeout_milliseconds = 29000
  cache_namespace      = "vkobgn"
  cache_key_parameters = []
}

resource "aws_api_gateway_deployment" "jp_rest_prod" {
  rest_api_id = aws_api_gateway_rest_api.jp_rest.id
  lifecycle {
    create_before_destroy = true
    ignore_changes        = [triggers]
  }
}

resource "aws_api_gateway_stage" "jp_rest_prod" {
  rest_api_id   = aws_api_gateway_rest_api.jp_rest.id
  stage_name    = "prod"
  deployment_id = aws_api_gateway_deployment.jp_rest_prod.id
}


# ============================================================================
# Lambda permissions
# ============================================================================

resource "aws_lambda_permission" "apigw_invite_any" {
  statement_id  = "apigw-invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.invite.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.jp_rest.id}/*/*/invite"
}

resource "aws_lambda_permission" "apigw_invite_get" {
  statement_id  = "apigw-vkobgn-GET"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.invite.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.jp_rest.id}/*/GET/invite"
}

# ── /feedback endpoint (unauthenticated, on REST API jp_rest) ─────────────

resource "aws_api_gateway_resource" "jp_rest_feedback" {
  rest_api_id = aws_api_gateway_rest_api.jp_rest.id
  parent_id   = aws_api_gateway_rest_api.jp_rest.root_resource_id
  path_part   = "feedback"
}

resource "aws_api_gateway_method" "jp_rest_feedback_post" {
  rest_api_id      = aws_api_gateway_rest_api.jp_rest.id
  resource_id      = aws_api_gateway_resource.jp_rest_feedback.id
  http_method      = "POST"
  authorization    = "NONE"
  api_key_required = false
}

resource "aws_api_gateway_integration" "jp_rest_feedback_post" {
  rest_api_id             = aws_api_gateway_rest_api.jp_rest.id
  resource_id             = aws_api_gateway_resource.jp_rest_feedback.id
  http_method             = aws_api_gateway_method.jp_rest_feedback_post.http_method
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.feedback.invoke_arn
  integration_http_method = "POST"
  timeout_milliseconds    = 29000
}

resource "aws_api_gateway_method" "jp_rest_feedback_options" {
  rest_api_id      = aws_api_gateway_rest_api.jp_rest.id
  resource_id      = aws_api_gateway_resource.jp_rest_feedback.id
  http_method      = "OPTIONS"
  authorization    = "NONE"
  api_key_required = false
}

resource "aws_api_gateway_method_response" "jp_rest_feedback_options_200" {
  rest_api_id = aws_api_gateway_rest_api.jp_rest.id
  resource_id = aws_api_gateway_resource.jp_rest_feedback.id
  http_method = aws_api_gateway_method.jp_rest_feedback_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration" "jp_rest_feedback_options" {
  rest_api_id          = aws_api_gateway_rest_api.jp_rest.id
  resource_id          = aws_api_gateway_resource.jp_rest_feedback.id
  http_method          = aws_api_gateway_method.jp_rest_feedback_options.http_method
  type                 = "MOCK"
  request_templates    = {
    "application/json" = "{\"statusCode\": 200}"
  }
  passthrough_behavior = "WHEN_NO_MATCH"
  timeout_milliseconds = 29000
}

resource "aws_api_gateway_integration_response" "jp_rest_feedback_options_200" {
  rest_api_id = aws_api_gateway_rest_api.jp_rest.id
  resource_id = aws_api_gateway_resource.jp_rest_feedback.id
  http_method = aws_api_gateway_method.jp_rest_feedback_options.http_method
  status_code = aws_api_gateway_method_response.jp_rest_feedback_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://jaetill.com'"
  }
  depends_on = [aws_api_gateway_integration.jp_rest_feedback_options]
}

resource "aws_lambda_permission" "apigw_feedback" {
  statement_id  = "apigw-feedback"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.feedback.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${var.aws_account_id}:${aws_api_gateway_rest_api.jp_rest.id}/*/POST/feedback"
}