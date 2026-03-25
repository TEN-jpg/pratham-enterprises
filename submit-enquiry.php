<?php

declare(strict_types=1);

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed.']);
    exit;
}

$config = [];
$configFile = __DIR__ . '/config.php';
if (file_exists($configFile)) {
    $config = require $configFile;
}

function config_value(array $config, string $key, string $default = ''): string
{
    $value = $config[$key] ?? getenv($key);
    return is_string($value) && $value !== '' ? $value : $default;
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function request_data(): array
{
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw ?: '', true);

    if (is_array($decoded)) {
        return $decoded;
    }

    return $_POST;
}

function valid_email(string $email): bool
{
    return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
}

function valid_phone(string $phone): bool
{
    return (bool) preg_match('/^[0-9]{10}$/', $phone);
}

function resend_send_email(string $apiKey, array $payload): array
{
    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
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

$data = request_data();

$name = trim((string) ($data['name'] ?? ''));
$phone = trim((string) ($data['phone'] ?? ''));
$email = trim((string) ($data['email'] ?? ''));
$requirement = trim((string) ($data['requirement'] ?? ''));
$property = trim((string) ($data['property'] ?? ''));
$description = trim((string) ($data['description'] ?? ''));

if ($name === '') {
    respond(400, ['message' => 'Full name is required.']);
}

if (!valid_phone($phone)) {
    respond(400, ['message' => 'Please enter a valid 10-digit phone number.']);
}

if (!valid_email($email)) {
    respond(400, ['message' => 'Please enter a valid email address.']);
}

if ($requirement === '') {
    respond(400, ['message' => 'Please select your requirement.']);
}

$apiKey = config_value($config, 'RESEND_API_KEY');
$receiver = config_value($config, 'ENQUIRY_RECEIVER_EMAIL', 'pratikbansod82@gmail.com');
$from = config_value($config, 'RESEND_FROM_EMAIL', 'onboarding@resend.dev');
$safeProperty = $property !== '' ? $property : 'General Enquiry';

if ($apiKey === '') {
    respond(500, ['message' => 'Email service is not configured.']);
}

$text = implode("\n", [
    "Name: {$name}",
    "Phone: {$phone}",
    "Email: {$email}",
    "Requirement: {$requirement}",
    "Property: {$safeProperty}",
    'Message: ' . ($description !== '' ? $description : 'No additional message provided.')
]);

$result = resend_send_email($apiKey, [
    'from' => $from,
    'to' => [$receiver],
    'subject' => "New Enquiry: {$safeProperty}",
    'text' => $text,
]);

if ($result['error'] !== '' || $result['status'] < 200 || $result['status'] >= 300) {
    respond(500, ['message' => 'We could not send your enquiry right now. Please try again.']);
}

respond(200, ['message' => 'Enquiry sent successfully.']);
