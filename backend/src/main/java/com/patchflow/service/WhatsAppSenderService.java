package com.patchflow.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Service
@Slf4j
public class WhatsAppSenderService {

    @Value("${app.whatsapp.url:https://mediaapi.smsgupshup.com/GatewayAPI/rest?}")
    private String baseUrl;

    @Value("${app.whatsapp.userid:2000251687}")
    private String userId;

    @Value("${app.whatsapp.password:Gyfj3BnY}")
    private String password;

    public void sendWhatsAppMessage(String phone, String messageText) throws Exception {
        log.info("Sending WhatsApp message via SMSGupshup to: {}", phone);

        String encodedMessage = URLEncoder.encode(messageText, StandardCharsets.UTF_8);
        String encodedPhone = URLEncoder.encode(phone, StandardCharsets.UTF_8);

        // Build the URL matching the pattern in kt.md
        StringBuilder urlBuilder = new StringBuilder(baseUrl);
        if (!baseUrl.endsWith("?") && !baseUrl.endsWith("&")) {
            urlBuilder.append("&");
        }
        urlBuilder.append("method=SendMessage")
                .append("&send_to=").append(encodedPhone)
                .append("&msg=").append(encodedMessage)
                .append("&msg_type=TEXT")
                .append("&userid=").append(userId)
                .append("&password=").append(password)
                .append("&v=1.1")
                .append("&auth_scheme=plain");

        String finalUrl = urlBuilder.toString();
        log.debug("WhatsApp Request URL: {}", finalUrl);

        HttpURLConnection connection = (HttpURLConnection) new URL(finalUrl).openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);

        int responseCode = connection.getResponseCode();
        if (responseCode == 200) {
            try (BufferedReader in = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                String inputLine;
                StringBuilder response = new StringBuilder();
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                log.info("WhatsApp response: {}", response.toString());
            }
        } else {
            throw new RuntimeException("HTTP GET failed with response code: " + responseCode);
        }
    }
}
