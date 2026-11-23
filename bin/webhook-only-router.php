<?php

declare(strict_types=1);

const MERCADOPAGO_WEBHOOK_PATH = '/api/payments/webhook/mercadopago';

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
$path = parse_url($uri, PHP_URL_PATH);

if (!is_string($path) || $path !== MERCADOPAGO_WEBHOOK_PATH) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo '{"error":{"code":"not_found","message":"Recurso não encontrado."}}';
    return;
}

if ($method !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo '{"error":{"code":"method_not_allowed","message":"Método não permitido."}}';
    return;
}

require dirname(__DIR__) . '/public/index.php';
