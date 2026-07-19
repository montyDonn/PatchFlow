package com.patchflow;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.support.SpringBootServletInitializer;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(exclude = {SecurityAutoConfiguration.class})
@EnableScheduling
public class PatchFlowApplication extends SpringBootServletInitializer {

    @Override
    protected SpringApplicationBuilder configure(SpringApplicationBuilder builder) {
        return builder.sources(PatchFlowApplication.class);
    }

    static {
        // Load .env file programmatically if it exists
        try {
            java.io.File envFile = new java.io.File(".env");
            if (envFile.exists()) {
                java.nio.file.Files.lines(envFile.toPath())
                    .map(String::trim)
                    .filter(line -> !line.isEmpty() && !line.startsWith("#"))
                    .forEach(line -> {
                        int eqIdx = line.indexOf('=');
                        if (eqIdx > 0) {
                            String key = line.substring(0, eqIdx).trim();
                            String val = line.substring(eqIdx + 1).trim();
                            if (val.startsWith("\"") && val.endsWith("\"")) {
                                val = val.substring(1, val.length() - 1);
                            } else if (val.startsWith("'") && val.endsWith("'")) {
                                val = val.substring(1, val.length() - 1);
                            }
                             System.setProperty(key, val);
                             if ("DATABASE_URL".equals(key)) {
                                 parseAndSetDatabaseUrl(val);
                             }
                         }
                     });
             }
         } catch (Exception e) {
             System.err.println("Failed to load .env file: " + e.getMessage());
         }
    }

    public static void main(String[] args) {
         SpringApplication.run(PatchFlowApplication.class, args);
     }

     private static void parseAndSetDatabaseUrl(String val) {
         try {
             String cleanVal = val;
             if (cleanVal.startsWith("postgresql://")) {
                 cleanVal = cleanVal.substring("postgresql://".length());
             } else if (cleanVal.startsWith("jdbc:postgresql://")) {
                 cleanVal = cleanVal.substring("jdbc:postgresql://".length());
             }

             int atIdx = cleanVal.indexOf('@');
             if (atIdx > 0) {
                 String credentials = cleanVal.substring(0, atIdx);
                 String hostAndDb = cleanVal.substring(atIdx + 1);

                 String username = "";
                 String password = "";
                 int colonIdx = credentials.indexOf(':');
                 if (colonIdx > 0) {
                     username = credentials.substring(0, colonIdx);
                     password = credentials.substring(colonIdx + 1);
                 } else {
                     username = credentials;
                 }

                 int slashIdx = hostAndDb.indexOf('/');
                 String host = "";
                 String dbAndOptions = "";
                 if (slashIdx > 0) {
                     host = hostAndDb.substring(0, slashIdx);
                     dbAndOptions = hostAndDb.substring(slashIdx + 1);
                 } else {
                     host = hostAndDb;
                 }

                 String jdbcUrl = "jdbc:postgresql://" + host + "/" + dbAndOptions;
                 System.setProperty("SPRING_DATASOURCE_URL", jdbcUrl);
                 System.setProperty("SPRING_DATASOURCE_USERNAME", username);
                 System.setProperty("SPRING_DATASOURCE_PASSWORD", password);
             } else {
                 String jdbcUrl = val;
                 if (val.startsWith("postgresql://")) {
                     jdbcUrl = "jdbc:" + val;
                 }
                 System.setProperty("SPRING_DATASOURCE_URL", jdbcUrl);
             }
         } catch (Exception e) {
             System.err.println("Failed to parse DATABASE_URL: " + e.getMessage());
             String jdbcUrl = val;
             if (val.startsWith("postgresql://")) {
                 jdbcUrl = "jdbc:" + val;
             }
             System.setProperty("SPRING_DATASOURCE_URL", jdbcUrl);
         }
     }
 }
