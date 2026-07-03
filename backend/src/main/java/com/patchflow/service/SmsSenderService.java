package com.patchflow.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

@Service
@Slf4j
public class SmsSenderService {

    @Value("${app.sms.metering-url:http://10.1.2.60:8080/metering/SmsStack}")
    private String soapUrl;

    @Value("${app.sms.enabled:false}")
    private boolean smsEnabled;

    public void sendSms(String phone, String messageText, String recipientName) throws Exception {
        // *** Feature flag: skip SMS when disabled ***
        if (!smsEnabled) {
            log.info("SMS integration disabled – skipping sendSms for {} (recipient: {})", phone, recipientName);
            return;
        }
        log.info("Sending SMS via SOAP to: {}, recipient: {}", phone, recipientName);

        // Escape XML characters in message and recipient name
        String escapedMsg = escapeXml(messageText);
        String escapedName = escapeXml(recipientName);

        // Construct SOAP Envelope payload
        String soapEnvelope = 
            "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\" xmlns:ser=\"http://service.metering.phoenix.com/\">" +
            "   <soapenv:Header/>" +
            "   <soapenv:Body>" +
            "      <ser:sendSMSBill>" +
            "         <arg0>" + phone + "</arg0>" +
            "         <arg1>" + escapedMsg + "</arg1>" +
            "         <arg2>" + escapedName + "</arg2>" +
            "      </ser:sendSMSBill>" +
            "   </soapenv:Body>" +
            "</soapenv:Envelope>";

        HttpURLConnection connection = (HttpURLConnection) new URL(soapUrl).openConnection();
        connection.setRequestMethod("POST");
        connection.setRequestProperty("Content-Type", "text/xml;charset=UTF-8");
        connection.setRequestProperty("SOAPAction", "");
        connection.setDoOutput(true);
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);

        try (OutputStream os = connection.getOutputStream()) {
            byte[] input = soapEnvelope.getBytes(StandardCharsets.UTF_8);
            os.write(input, 0, input.length);
        }

        int responseCode = connection.getResponseCode();
        if (responseCode == 200 || responseCode == 202) {
            try (BufferedReader in = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                String inputLine;
                StringBuilder response = new StringBuilder();
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                log.info("SMS SOAP response received: {}", response.toString());
            }
        } else {
            try (BufferedReader in = new BufferedReader(new InputStreamReader(connection.getErrorStream(), StandardCharsets.UTF_8))) {
                String inputLine;
                StringBuilder response = new StringBuilder();
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                throw new RuntimeException("SMS SOAP request failed with response code: " + responseCode + ", error: " + response.toString());
            }
        }
    }

    private String escapeXml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
