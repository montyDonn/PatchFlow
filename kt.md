# Knowledge Transfer: Notification System in Billing Module

## Objective

This document explains how **user notifications** work in the **Billing module** so that developers of **Project X (Patch Module)** can replicate the exact same pattern.

---

## 1. System Architecture (High Level)

```
[User/UI] --> Controller --> Service --> DAO --> DB2 (MBC_USER)
                           |                    |
                           |                    +--> SMS_STACK table
                           |                    +--> WHATSAPP_MESSAGE_STACK table
                           |
                           +--> External Services (SOAP/REST via CXF)
                           |    - SmsStackService (metering module)
                           |    - Email (direct SMTP)
                           |    - WhatsApp (HTTPS to SMSGupshup)
                           |
                           +--> Quartz Scheduler (reads stack tables, sends notifications)
```

### Stack
- **Java 6/7** on **JBoss 6.1**
- **Spring 3.2** (MVC, DI, ORM, JMS, TX)
- **Hibernate 3.x** (JPA 2.0) with **DB2** database
- **Quartz 2.2** for scheduled jobs
- **Apache CXF** for SOAP web services

---

## 2. Three Notification Channels

| Channel | Mechanism | When It Fires | Who Handles Sending |
|---|---|---|---|
| **Email** | JavaMail SMTP (synchronous) | Bill generation, bill preview, bulk scheduled | Same module (Billing) |
| **SMS** | Queue-based via `SMS_STACK` table | Bill generation, bill preview, bulk scheduled | **Metering module** (separate SOAP service) |
| **WhatsApp** | Queue-based via `WHATSAPP_MESSAGE_STACK` table + Quartz push | Bill generation, scheduled bulk | Same module (Billing) |

---

## 3. Email Notification Pattern

### 3.1 Direct Email Sending

**Used for:** Real-time email from controllers (bill preview, PDF email).

**Key files:**

| File | Path | Role |
|---|---|---|
| `BulkEmailService` | `com.phoenix.billing.service.BulkEmailService` | Interface |
| `BulkEmailServiceImpl` | `com.phoenix.billing.service.BulkEmailServiceImpl` | Implementation |
| `CommonPdfServiceImpl` | `com.phoenix.billing.service.CommonPdfServiceImpl` | Also has `sendEmail()` method |
| `SendBillPdfEmailController` | `com.phoenix.billing.controller.SendBillPdfEmailController` | Controller that triggers email |
| `BillPreviewController` | `com.phoenix.billing.controller.BillPreviewController.java:2309` | Email from bill preview page |

**SMTP Configuration** (hardcoded in `BulkEmailServiceImpl.java:11205`):
```java
props.put("mail.host", "10.1.2.50");
props.put("mail.smtp.port", "25");
props.put("mail.smtp.auth", "true");
// sender: info@upcl.org / password: itia@urja123
```

**Calling pattern (real-time):**
```java
// From any controller or service:
@Autowired BulkEmailService bulkEmailService;

bulkEmailService.sendEmail(
    "recipient@example.com",   // mailRecepient
    null,                      // mailcc
    null,                      // mailbcc
    "Subject line",            // mailSubject
    "Email body text",         // mailContent
    "attachment.pdf"           // mailAttachment (or null)
);
```

### 3.2 Bulk Scheduled Email

**Used for:** Sending bills to all consumers who have email IDs.

**Key files:**

| File | Path | Role |
|---|---|---|
| `BulkEmailSendingJob` | `com.phoenix.schedule.BulkEmailSendingJob` | Quartz job (extends `QuartzJobBean`) |
| `BulkEmailSendingTask` | `com.phoenix.schedule.BulkEmailSendingTask` | Business logic: queries consumers, generates PDF, sends email |

**Flow:**
```
Quartz trigger fires
  --> BulkEmailSendingJob.executeInternal()
    --> BulkEmailSendingTask.autoEmailSend()
      --> Native SQL: SELECT consumers with email + unbilled bills + ROWNUM <= 3000
      --> For each:
          1. Generate PDF (getLtPdf / getHtPdf / getSolarPdf)
          2. bulkEmailService.sendEmail(email, subject, content, pdf)
          3. UPDATE BILL_DETAILS_T SET BILLPRINT_FLAG='1'
```

---

## 4. SMS Notification Pattern

### 4.1 Key Architecture

SMS uses a **push-to-queue** pattern. The billing module inserts records into the `SMS_STACK` table. An **external metering module** picks them up via SOAP web service and sends the SMS.

### 4.2 Key Files

| File | Path | Role |
|---|---|---|
| `SmsStackVO` | `com.phoenix.metering.vo.SmsStackVO` | JPA entity for `SMS_STACK` table |
| `SmsStackDAO` | `com.phoenix.billing.dao.SmsStackDAO` | DAO interface for SMS_STACK |
| `SmsStackDAOImpl` | `com.phoenix.billing.dao.SmsStackDAOImpl` | DAO: `entityManager.persist()` |
| `BillDetailsTDAO` | `com.phoenix.billing.dao.BillDetailsTDAO` | Has `sendSmsBill(SmsStackVO)` helper |
| `SmsStackService` (remote) | `com.phoenix.metering.service.SmsStackService` | SOAP web service (metering module) |
| `BillingRulesImpl.sendSms()` | `com.phoenix.billing.service.BillingRulesImpl.java:55366` | Insert SMS during bill processing |
| `BillPreviewController.sendSMS()` | `com.phoenix.billing.controller.BillPreviewController.java:2151` | Insert SMS from bill preview UI |
| `BulkEmailSendingTask.bulkSmsSendService()` | `com.phoenix.schedule.BulkEmailSendingTask.java:374` | Insert SMS during bulk email |

### 4.3 SMS_STACK Table Structure

Columns: `ID`, `RECEIPENT`, `MSG_TEXT`, `MODULE_NAME`, `SEND_FLAG`, `CONS_NUM`, `CREATE_DATE`, `CTID`, `LOGIN_ID`, `PASS_WORD`, `UNI_CODE`

### 4.4 Calling Pattern (Real-time)

```java
// From any service or controller:

// 1. Query SMS template from MESSAGE_CTID_T
String ctidQry = "SELECT A.CT_ID, A.REFERENCE_ID, A.MSG_TEXT, A.LOGIN, A.PASSWORD, A.UNICODE " +
                 "FROM MESSAGE_CTID_T A WHERE A.RECORD_STATUS=1 " +
                 "AND A.MODULE='BILLING' AND A.MSG_TYPE='BILL_AMT' " +
                 "AND TO_CHAR(A.EFFECTED_DATE,'DD-MM-YYYY') = " +
                 "(SELECT TO_CHAR(MAX(B.EFFECTED_DATE),'DD-MM-YYYY') FROM MESSAGE_CTID_T B " +
                 "WHERE B.RECORD_STATUS=1 AND B.MODULE=A.MODULE)";
List<Object> messageCtidList = billDetailsTDAO.findDataByNativeQry(ctidQry);

// 2. Replace template placeholders
String smsText = templateFromDB;
smsText = smsText.replace("#PAR1#", billAmount);
smsText = smsText.replace("#PAR2#", month+"/"+year);
smsText = smsText.replace("#PAR3#", accountNo);
smsText = smsText.replace("#PAR4#", dueDate);

// 3. Create VO and persist
SmsStackVO smsStackVO = new SmsStackVO();
smsStackVO.setModuleName("BILLING");    // <-- identifies source module
smsStackVO.setMsgText(smsText);
smsStackVO.setReceipent(phoneNumber);
smsStackVO.setSendFlag("T");            // T = to-send
smsStackVO.setConsNum(consumerId);
smsStackVO.setCretaeDate(new Date());
smsStackVO.setCtid(billCtid);           // template reference
smsStackVO.setLoginId("upcl_hsi");      // SMS gateway login
smsStackVO.setPassWord("upcl@123");     // SMS gateway password
smsStackVO.setUniCode("12");            // Unicode flag

// 4. Persist (method is in BillDetailsTDAO, just does entityManager.persist())
billDetailsTDAO.sendSmsBill(smsStackVO);
```

### 4.5 SMS via SOAP Web Service (Alternative)

The billing module also has a CXF proxy to call metering module's `SmsStackService`:

```xml
<!-- Defined in mpower-service.xml -->
<bean id="smsStackServiceFactory" class="org.apache.cxf.jaxws.JaxWsProxyFactoryBean">
    <property name="serviceClass" value="com.phoenix.metering.service.SmsStackService"/>
    <property name="address" value="${metering}/SmsStack"/>
</bean>
```

The `SmsStackService` interface has:
```java
public void save(SmsStackVO vo);
public String sendSMSBill(String phone, String msgtxt, String name);
```

---

## 5. WhatsApp Notification Pattern

### 5.1 Key Architecture

WhatsApp uses a **two-phase pattern**:
1. **Phase 1 (Business Logic):** Insert record into `WHATSAPP_MESSAGE_STACK` with `STATUS='PENDING'`
2. **Phase 2 (Scheduled):** Quartz job reads pending records, calls SMSGupshup API, updates status

### 5.2 Key Files

| File | Path | Role |
|---|---|---|
| **VO Layer** | | |
| `WhatsappMessageStackVO` | `com.phoenix.billing.vo.WhatsappMessageStackVO` | JPA entity for `WHATSAPP_MESSAGE_STACK` (extends ObjectVO) |
| `WhatsappMessageCtidMVO` | `com.phoenix.billing.vo.WhatsappMessageCtidMVO` | Template master entity (extends ObjectVO) |
| **DAO Layer** | | |
| `WhatsappMessageStackDAO` | `com.phoenix.billing.dao.WhatsappMessageStackDAO` | DAO interface: save, update, find |
| `WhatsappMessageStackDAOImpl` | `com.phoenix.billing.dao.WhatsappMessageStackDAOImpl` | Impl: `@PersistenceContext EntityManager` + `SessionData` |
| `BillDetailsTDAO` | `com.phoenix.billing.dao.BillDetailsTDAO` | Has `sendWhatAppSmsBill()` helper |
| **Service Layer** | | |
| `WhatsappMessageCreateService` | `com.phoenix.billing.service.WhatsappMessageCreateService` | Creates formatted message from template |
| `WhatsappMessageCreateServiceImpl` | `com.phoenix.billing.service.WhatsappMessageCreateServiceImpl` | Fetches template, replaces `#PAR1#...#PAR12#`, calls send service |
| `WhatsappMessageSendService` | `com.phoenix.billing.service.WhatsappMessageSendService` | Interface for actual HTTP sender |
| `WhatsappMessageSendServiceImpl` | `com.phoenix.billing.service.WhatsappMessageSendServiceImpl` | HTTPS GET to SMSGupshup API |
| `WhatsappMessageStackService` | `com.phoenix.billing.service.WhatsappMessageStackService` | Stack service interface |
| `WhatsappMessageStackServiceImpl` | `com.phoenix.billing.service.WhatsappMessageStackServiceImpl` | Delegates to DAO |
| `WhatsappMessageCtidMService` | `com.phoenix.billing.service.WhatsappMessageCtidMService` | Template master service |
| **Business Logic** | | |
| `BillingRulesImpl.sendWhatsAppSms()` | `com.phoenix.billing.service.BillingRulesImpl.java:61539` | Inserts WhatsApp stack record during bill processing |
| **Scheduled Jobs** | | |
| `WhatsappMessagePushSchedulerJob` | `com.phoenix.schedule.WhatsappMessagePushSchedulerJob` | Quartz job (infinite loop with 10min sleep) |
| `WhatsappMessagePushTask` | `com.phoenix.schedule.WhatsappMessagePushTask` | Reads pending stack, sends via API, updates status |
| **Constants** | | |
| `WhatsappMessageCodeConstants` | `com.phoenix.billing.util.WhatsappMessageCodeConstants` | `bill_alert_sm`, `bill_alert_common`, `payment_notice`, `bill_alert_with_pdf` |

### 5.3 WHATSAPP_MESSAGE_STACK Table

**Entity:** `WhatsappMessageStackVO` → Table `WHATSAPP_MESSAGE_STACK`

Key columns: `ID` (primary key), `MOBILE_NO`, `MESSAGE`, `MESSAGE_TYPE`, `STATUS` (PENDING/SUCCESS/FAIL), `TEMPLATE_ID`, `ACCOUNT_NO`, `UPLOADED_BILL_PDF_URL`, `DOWNLOAD_BILL_PDF_URL`

+ all fields from `ObjectVO`: `CREATE_DATE`, `UPDATE_DATE`, `RECORD_STATUS` (soft delete = 1), `CREATED_BY`, `UPDATED_BY`, `IP_ADDRESS`, `MODULE_ID`, `SUBMODULE_ID`, `SCREEN_ID`, `SOURCE_OFFICE_ID`, `FLAG1`, `FLAG2`, `CHECK_CONDITION`

### 5.4 WHATSAPP_MESSAGE_CTID_M Table (Templates)

**Entity:** `WhatsappMessageCtidMVO` → Table `WHATSAPP_MESSAGE_CTID_M`

Key columns: `ID`, `TEMPLATE_ID`, `MESSAGE_TYPE`, `METHOD`, `TEMPLATE_MESSAGE` (with `#PAR1#`...`#PAR12#` placeholders), `HEADER`, `FOOTER`, `WHATSAPP_MESSAGE_U_CODE` (e.g. `bill_alert_common`)

### 5.5 Calling Pattern (Phase 1 - Queue Insertion)

```java
// From BillingRulesImpl.sendWhatsAppSms() at line 61539:

// 1. Fetch template from WHATSAPP_MESSAGE_CTID_M
String ctidQry = "SELECT A.TEMPLATE_ID, A.TEMPLATE_MESSAGE " +
                 "FROM WHATSAPP_MESSAGE_CTID_M A " +
                 "WHERE A.RECORD_STATUS=1 " +
                 "AND A.WHATSAPP_MESSAGE_U_CODE='bill_alert_common'";
List<Object> messageCtidList = billDetailsTDAO.findDataByNativeQry(ctidQry);

// 2. Replace template placeholders
message = templateFromDB;
message = message.replace("#PAR1#", consumerName);
message = message.replace("#PAR2#", accountNumber);
// ... up to #PAR12#

// 3. Create stack VO and persist
WhatsappMessageStackVO vo = new WhatsappMessageStackVO();
vo.setMobileNumber(phoneNumber);
vo.setMessage(message);
vo.setUploadedBillPdfUrl("https://....");
vo.setMessageType("Billing");
vo.setStatus("PENDING");       // <-- key: marks as pending for Quartz
vo.setTemplateId(templateId);
vo.setAccountNo(accountNumber);
vo.setCheckCondition(accountNumber + "," + month + "/" + year + ",Billing");

billDetailsTDAO.sendWhatAppSmsBill(vo);  // just entityManager.persist() + flush()
```

### 5.6 Calling Pattern (Phase 2 - Real-time Send via Service)

If you want to send WhatsApp immediately (not queue-based), call `WhatsappMessageCreateService` directly:

```java
@Autowired WhatsappMessageCreateService whatsappMessageCreateService;

// Overloaded method that accepts pre-fetched template VO + message:
String status = whatsappMessageCreateService.createBillAlertCommon(
    whatsappMessageCtidMVO,  // template VO
    message,                 // already-rendered message
    accountNumber,
    mobileNumber
);
// Returns "SUCCESS" or "FAIL"
```

OR use the individual alert methods:
```java
// Bill alert
whatsappMessageCreateService.createBillAlertCommon(
    consumerName, accountNumber, billMonthYear,
    billDate, dueDate, billAmount, rebateDays, rebatePercentageText, mobileNumber
);

// Payment confirmation
whatsappMessageCreateService.createPaymentConfirmationAlert(
    consumerName, accountNumber, serviceConnectionNumber,
    transactionAmount, transactionDate, transactionNumber, receiptNumber, mobileNumber
);

// Bill with PDF
whatsappMessageCreateService.createBillAlertWithAttachedPdf(
    consumerName, accountNumber, billNumber, monthYear,
    billDate, dueDate, dueAmount, rebateDays,
    onlineRebate, offlineRebate, maxRebate,
    mobileNumber, pdfUrl, buttonActionUrl
);
```

### 5.7 Phase 2 - Quartz Push Task

**File:** `WhatsappMessagePushTask.java`

```java
// Runs every 10 minutes (WhatsappMessagePushSchedulerJob has infinite loop + Thread.sleep(600000))
public void runSchedule() {
    // Native SQL to fetch PENDING records
    String qry = "SELECT A.ID, A.TEMPLATE_ID, A.MESSAGE, A.ACCOUNT_NO, A.MOBILE_NO " +
                 "FROM WHATSAPP_MESSAGE_STACK A " +
                 "WHERE NVL(A.MESSAGE_TYPE,'N') = 'Billing' " +
                 "AND NVL(A.STATUS,'N') = 'PENDING' " +
                 "AND A.RECORD_STATUS=1 AND ROWNUM <= 8000";

    List<Object> dataList = billDetailsTDAO.findDataByNativeQry(qry);

    for (each row) {
        // 1. Fetch template by templateId
        WhatsappMessageCtidMVO template = whatsappMessageCtidMService
            .findByWhere("o.templateId='" + templateId + "'").get(0);

        // 2. Send via createBillAlertCommon() which internally calls SMSGupshup API
        String status = whatsappMessageCreateService
            .createBillAlertCommon(template, message, accountNumber, mobileNumber);

        // 3. Update stack record
        String updateQry = "UPDATE WHATSAPP_MESSAGE_STACK SET STATUS='" + status +
                           "', UPDATED_BY='100-1', UPDATE_DATE=SYSDATE WHERE ID='" + id + "'";
        billDetailsTDAO.updateByNativeQry(updateQry);
    }
}
```

### 5.8 SMSGupshup API (Actual HTTP Call)

**File:** `WhatsappMessageSendServiceImpl.java:21`

```java
private final String BASE_URL = "https://mediaapi.smsgupshup.com/GatewayAPI/rest?";
private final String USER_ID = "2000251687";
private final String PASSWORD = "Gyfj3BnY";
private final String VERSION = "1.1";
private final String FORMAT = "json";

// Builds URL: BASE_URL + userid=2000251687&password=Gyfj3BnY&send_to={phone}&...
// Sends as HTTPS GET
HttpsURLConnection connection = (HttpsURLConnection) new URL(finalUrl).openConnection();
```

---

## 6. Seasonal Bill Notification Flow (End-to-End Example)

This shows how **all 3 channels** fire during bill generation:

```
Bill Generation (BillingRulesImpl.java)
  |
  +--> sendSms() [line 55366]
  |     1. Query MESSAGE_CTID_T for SMS template (MSG_TYPE='BILL_AMT')
  |     2. Replace #PAR1# (amount), #PAR2# (month/yr), #PAR3# (acct), #PAR4# (dueDate)
  |     3. SmsStackVO --> billDetailsTDAO.sendSmsBill() --> SMS_STACK table
  |     4. Metering module picks up via SOAP --> SMS sent to consumer
  |
  +--> sendWhatsAppSms() [line 61539]
        1. Query WHATSAPP_MESSAGE_CTID_M for template (U_CODE='bill_alert_common')
        2. Replace #PAR1#..#PAR12# with consumer/bill data
        3. WhatsappMessageStackVO --> billDetailsTDAO.sendWhatAppSmsBill()
           --> WHATSAPP_MESSAGE_STACK table (STATUS='PENDING')
        4. WhatsappMessagePushTask (Quartz every 10min) picks it up
           --> SMSGupshup API --> WhatsApp sent
           --> STATUS updated to 'SUCCESS' or 'FAIL'

Bulk Email Schedule (BulkEmailSendingTask.java)
  |
  +--> autoEmailSend()
        1. Query consumers with email + unbilled bills
        2. Generate PDF
        3. bulkEmailService.sendEmail() --> SMTP --> Email sent
        4. Optionally also sends WhatsApp (commented out in current code)
```

---

## 7. How to Replicate for Project X (Patch Module)

### 7.1 Recommended Approach

For **Project X** (real-time + all 3 channels), follow this pattern:

#### Option A: Use Existing Services Directly (Recommended)

Inject the existing notification services into your Patch service:

```java
@Service
public class PatchNotificationService {

    @Autowired private BulkEmailService bulkEmailService;
    @Autowired private BillDetailsTDAO billDetailsTDAO;     // for sendSmsBill()
    @Autowired private WhatsappMessageCreateService whatsappMessageCreateService;

    public void notifyStageChange(PatchRequest patch, String stage, String assigneeEmail,
                                   String assigneePhone, String assigneeName) {

        String message = "Patch #" + patch.getId() + " assigned for " + stage + " to " + assigneeName;

        // 1. EMAIL (real-time)
        bulkEmailService.sendEmail(assigneeEmail, null, null,
            "Patch " + patch.getId() + " - Stage: " + stage, message, null);

        // 2. SMS (push to queue - metering module sends)
        SmsStackVO sms = new SmsStackVO();
        sms.setModuleName("PATCH");
        sms.setMsgText(message);
        sms.setReceipent(assigneePhone);
        sms.setSendFlag("T");
        billDetailsTDAO.sendSmsBill(sms);

        // 3. WHATSAPP (real-time via service)
        whatsappMessageCreateService createBillAlertCommon(
            templateVO, message, patch.getId(), assigneePhone);
    }
}
```

#### Option B: Use Your Own Stack Table + Quartz Push

If you want a dedicated notification queue in your `patchSchema`:

| Layer | Class Name | Copy Template From |
|---|---|---|
| **Entity** | `PatchNotifStackVO` | `WhatsappMessageStackVO.java` |
| **DAO** | `PatchNotifStackDAO` + `Impl` | `WhatsappMessageStackDAOImpl.java` |
| **Scheduled Job** | `PatchNotifPushSchedulerJob` | `WhatsappMessagePushSchedulerJob.java` |
| **Scheduled Task** | `PatchNotifPushTask` | `WhatsappMessagePushTask.java` |
| **Constants** | `PatchNotifCodeConstants` | `WhatsappMessageCodeConstants.java` |
| **XML Config** | `mpower-schedular.xml` | Quartz bean registration (JobDetailBean → CronTriggerBean → SchedulerFactoryBean) |

#### Minimum DB Table: `PATCH_NOTIFICATION_STACK`

```sql
Columns: ID (PK), RECEIVER_ID, NOTIF_TYPE (EMAIL/SMS/WHATSAPP),
         MESSAGE, STAGE, STATUS (PENDING/SUCCESS/FAIL),
         REFERENCE_ID, CREATE_DATE, RECORD_STATUS
```

### 7.2 Important Notes for Project X

1. **SMS sending is handled by the Metering module** via `SMS_STACK` table. You only need to insert into this table.
2. **WhatsApp templates** are stored in `WHATSAPP_MESSAGE_CTID_M`. You'll need to add new template entries for patch notifications or call `WhatsappMessageSendService.sendMessage()` directly with hardcoded params.
3. **Email SMTP** is hardcoded to `10.1.2.50:25` with auth `info@upcl.org`. Your module will use the same SMTP server.
4. **ObjectVO** base class provides: `id`, `createDate`, `updateDate`, `recordStatus`, `createdBy`, `updatedBy`, `ipAddress`, `moduleId`, `subModuleId`, `screenId`, `sourceOfficeId`.
5. **SessionData** is a utility that sets audit fields (`createdBy`, `ipAddress`, etc.) on save/update. Inject it in your DAOs.

---

## 8. Complete File Reference

### SMS Channel

| File | Absolute Path |
|---|---|
| SmsStackVO | `UpclBilling/src/com/phoenix/metering/vo/SmsStackVO.java` |
| SmsStackDAO | `UpclBilling/src/com/phoenix/billing/dao/SmsStackDAO.java` |
| SmsStackDAOImpl | `UpclBilling/src/com/phoenix/billing/dao/SmsStackDAOImpl.java` |
| SmsStackService (remote) | `UpclBilling/src/com/phoenix/metering/service/SmsStackService.java` |
| BillDetailsTDAO (sendSmsBill helper) | `UpclBilling/src/com/phoenix/billing/dao/BillDetailsTDAO.java:47` |
| BillingRulesImpl.sendSms() | `UpclBilling/src/com/phoenix/billing/service/BillingRulesImpl.java:55366` |
| BillPreviewController.sendSMS() | `UpclBilling/src/com/phoenix/billing/controller/BillPreviewController.java:2151` |
| BulkEmailSendingTask.bulkSmsSendService() | `UpclBilling/src/com/phoenix/schedule/BulkEmailSendingTask.java:374` |

### Email Channel

| File | Absolute Path |
|---|---|
| BulkEmailService | `UpclBilling/src/com/phoenix/billing/service/BulkEmailService.java` |
| BulkEmailServiceImpl | `UpclBilling/src/com/phoenix/billing/service/BulkEmailServiceImpl.java` |
| CommonPdfServiceImpl.sendEmail() | `UpclBilling/src/com/phoenix/billing/service/CommonPdfServiceImpl.java:217` |
| BulkEmailSendingJob | `UpclBilling/src/com/phoenix/schedule/BulkEmailSendingJob.java` |
| BulkEmailSendingTask | `UpclBilling/src/com/phoenix/schedule/BulkEmailSendingTask.java` |
| SendBillPdfEmailController | `UpclBilling/src/com/phoenix/billing/controller/SendBillPdfEmailController.java` |
| BillPreviewController.sendEmail() | `UpclBilling/src/com/phoenix/billing/controller/BillPreviewController.java:2309` |

### WhatsApp Channel

| File | Absolute Path |
|---|---|
| WhatsappMessageStackVO | `UpclBilling/src/com/phoenix/billing/vo/WhatsappMessageStackVO.java` |
| WhatsappMessageCtidMVO | `UpclBilling/src/com/phoenix/billing/vo/WhatsappMessageCtidMVO.java` |
| WhatsappMessageStackDAO | `UpclBilling/src/com/phoenix/billing/dao/WhatsappMessageStackDAO.java` |
| WhatsappMessageStackDAOImpl | `UpclBilling/src/com/phoenix/billing/dao/WhatsappMessageStackDAOImpl.java` |
| WhatsappMessageStackService | `UpclBilling/src/com/phoenix/billing/service/WhatsappMessageStackService.java` |
| WhatsappMessageStackServiceImpl | `UpclBilling/src/com/phoenix/billing/service/WhatsappMessageStackServiceImpl.java` |
| WhatsappMessageCreateService | `UpclBilling/src/com/phoenix/billing/service/WhatsappMessageCreateService.java` |
| WhatsappMessageCreateServiceImpl | `UpclBilling/src/com/phoenix/billing/service/WhatsappMessageCreateServiceImpl.java` |
| WhatsappMessageSendService | `UpclBilling/src/com/phoenix/billing/service/WhatsappMessageSendService.java` |
| WhatsappMessageSendServiceImpl | `UpclBilling/src/com/phoenix/billing/service/WhatsappMessageSendServiceImpl.java` |
| WhatsappMessageCtidMService | `UpclBilling/src/com/phoenix/billing/service/WhatsappMessageCtidMService.java` |
| WhatsappMessageCtidMServiceImpl | `UpclBilling/src/com/phoenix/billing/service/WhatsappMessageCtidMServiceImpl.java` |
| WhatsappMessageCodeConstants | `UpclBilling/src/com/phoenix/billing/util/WhatsappMessageCodeConstants.java` |
| BillingRulesImpl.sendWhatsAppSms() | `UpclBilling/src/com/phoenix/billing/service/BillingRulesImpl.java:61539` |
| BillDetailsTDAO.sendWhatAppSmsBill() | `UpclBilling/src/com/phoenix/billing/dao/BillDetailsTDAO.java:48` |
| WhatsappMessagePushSchedulerJob | `UpclBilling/src/com/phoenix/schedule/WhatsappMessagePushSchedulerJob.java` |
| WhatsappMessagePushTask | `UpclBilling/src/com/phoenix/schedule/WhatsappMessagePushTask.java` |

### Configuration Files

| File | Absolute Path |
|---|---|
| Service URLs | `UpclBilling/src/conf.properties` |
| Quartz Scheduler Config | `jboss-6.1.0.Final/server/default/deploy/upcl.ear/billing.war/WEB-INF/mpower-schedular.xml` |
| Spring Service Beans | `jboss-6.1.0.Final/server/default/deploy/upcl.ear/billing.war/WEB-INF/mpower-service.xml` |
| Spring Data/DB Config | `jboss-6.1.0.Final/server/default/deploy/upcl.ear/billing.war/WEB-INF/mpower-data.xml` |
| Hibernate Config | `UpclBilling/src/hibernate.properties` |
| JPA Persistence | `UpclBilling/src/META-INF/persistence.xml` |

---

## 9. Key Quartz Scheduling Pattern

Every scheduled job follows this exact XML pattern in `mpower-schedular.xml`:

```xml
<!-- 1. Task bean (business logic) -->
<bean id="someTask" class="com.phoenix.schedule.SomeTask" />

<!-- 2. Job bean (thin wrapper, extends QuartzJobBean) -->
<bean name="someJob" class="org.springframework.scheduling.quartz.JobDetailBean">
    <property name="jobClass" value="com.phoenix.schedule.SomeJob" />
    <property name="jobDataAsMap">
        <map>
            <entry key="someTask" value-ref="someTask" />
        </map>
    </property>
</bean>

<!-- 3. Cron trigger -->
<bean id="cronTrigger" class="org.springframework.scheduling.quartz.CronTriggerBean">
    <property name="jobDetail" ref="someJob" />
    <property name="cronExpression" value="0 0/5 * * * ?" />
</bean>

<!-- 4. Scheduler factory -->
<bean class="org.springframework.scheduling.quartz.SchedulerFactoryBean">
    <property name="jobDetails">
        <list><ref bean="someJob" /></list>
    </property>
    <property name="triggers">
        <list><ref bean="cronTrigger" /></list>
    </property>
</bean>
```

---

## 10. Summary: What You Need to Create for Project X

| # | What | Pattern to Follow |
|---|---|---|
| 1 | A service that sends Email + SMS + WhatsApp | Inject `BulkEmailService`, `BillDetailsTDAO` (for SMS), `WhatsappMessageCreateService` |
| 2 | A controller that triggers the service on stage transition | Copy pattern from `BillPreviewController.sendSMS()` or `BillingRulesImpl.sendWhatsAppSms()` |
| 3 | (Optional) A dedicated stack table in patchSchema | Copy `WhatsappMessageStackVO` + `WhatsappMessageStackDAOImpl` |
| 4 | (Optional) A Quartz push task for your stack table | Copy `WhatsappMessagePushTask` + `WhatsappMessagePushSchedulerJob` |
| 5 | XML Quartz config in `mpower-schedular.xml` | Copy existing Quartz bean registration pattern |

---

*End of KT Document*
