import {
  to = aws_api_gateway_rest_api.jp_rest
  id = "eqidhh18u2"
}

import {
  to = aws_api_gateway_authorizer.jp_rest_jaetill_cognito
  id = "eqidhh18u2/l6sj74"
}

import {
  to = aws_api_gateway_resource.jp_rest_invite
  id = "eqidhh18u2/vkobgn"
}

import {
  to = aws_api_gateway_method.jp_rest_invite_get
  id = "eqidhh18u2/vkobgn/GET"
}

import {
  to = aws_api_gateway_integration.jp_rest_invite_get
  id = "eqidhh18u2/vkobgn/GET"
}

import {
  to = aws_api_gateway_method.jp_rest_invite_options
  id = "eqidhh18u2/vkobgn/OPTIONS"
}

import {
  to = aws_api_gateway_integration.jp_rest_invite_options
  id = "eqidhh18u2/vkobgn/OPTIONS"
}

import {
  to = aws_api_gateway_method.jp_rest_invite_post
  id = "eqidhh18u2/vkobgn/POST"
}

import {
  to = aws_api_gateway_integration.jp_rest_invite_post
  id = "eqidhh18u2/vkobgn/POST"
}

import {
  to = aws_api_gateway_deployment.jp_rest_prod
  id = "eqidhh18u2/3t3jnw"
}

import {
  to = aws_api_gateway_stage.jp_rest_prod
  id = "eqidhh18u2/prod"
}


import {
  to = aws_lambda_permission.apigw_invite_any
  id = "jaetill-portal-invite/apigw-invoke"
}

import {
  to = aws_lambda_permission.apigw_invite_get
  id = "jaetill-portal-invite/apigw-vkobgn-GET"
}
