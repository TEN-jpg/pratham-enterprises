<?php

declare(strict_types=1);

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

$config = [];
$configFile = __DIR__ . '/config.php';
if (file_exists($configFile)) {
    $config = require $configFile;
}

function tracker_config_value(array $config, string $key, string $default = ''): string
{
    $value = $config[$key] ?? getenv($key);
    return is_string($value) && $value !== '' ? $value : $default;
}

function tracker_respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function tracker_request_data(): array
{
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw ?: '', true);

    if (is_array($decoded)) {
        return $decoded;
    }

    return $_POST;
}

function telegram_send_message(string $token, string $chatId, string $message): array
{
    $ch = curl_init("https://api.telegram.org/bot{$token}/sendMessage");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode([
            'chat_id' => $chatId,
            'text' => $message,
        ]),
    ]);

    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    return [
        'status' => $status,
        'body' => $response ?: '',
        'error' => $error,
    ];
}

$data = tracker_request_data();
$propertyName = trim((string) ($data['propertyName'] ?? ''));
$viewerPhone = trim((string) ($data['viewerPhone'] ?? ''));

if ($propertyName === '' || !preg_match('/^[0-9]{10}$/', $viewerPhone)) {
    tracker_respond(400, ['error' => 'Invalid property view payload.']);
}

$token = tracker_config_value($config, 'TELEGRAM_BOT_TOKEN');
$chatId = tracker_config_value($config, 'TELEGRAM_CHAT_ID');

if ($token === '' || $chatId === '') {
    tracker_respond(500, ['error' => 'Telegram is not configured.']);
}

$message = "Name of Property: {$propertyName}\nViewer's Phone Number: {$viewerPhone}";

$result = telegram_send_message($token, $chatId, $message);

if ($result['error'] !== '' || $result['status'] < 200 || $result['status'] >= 300) {
    tracker_respond(500, ['error' => 'Telegram failed.']);
}

tracker_respond(200, ['success' => true]);
