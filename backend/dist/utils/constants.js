"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskStatus = exports.Role = void 0;
var Role;
(function (Role) {
    Role["SUPER_ADMIN"] = "SUPER_ADMIN";
    Role["CLIENT"] = "CLIENT";
    Role["ADMIN"] = "ADMIN";
    Role["MANAGER"] = "MANAGER";
    Role["DEVELOPER"] = "DEVELOPER";
    Role["VERIFIER"] = "VERIFIER";
})(Role || (exports.Role = Role = {}));
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["DRAFT"] = "DRAFT";
    TaskStatus["ASSIGNED"] = "ASSIGNED";
    TaskStatus["PENDING_APPROVAL"] = "PENDING_APPROVAL";
    TaskStatus["IN_DEVELOPMENT"] = "IN_DEVELOPMENT";
    TaskStatus["VERIFYING"] = "VERIFYING";
    TaskStatus["COMPLETED"] = "COMPLETED";
    TaskStatus["RETURNED_TO_DEVELOPER"] = "RETURNED_TO_DEVELOPER";
    TaskStatus["REJECTED"] = "REJECTED";
    TaskStatus["DELAYED"] = "DELAYED";
    TaskStatus["ON_HOLD"] = "ON_HOLD";
    TaskStatus["CANCELLED"] = "CANCELLED";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
