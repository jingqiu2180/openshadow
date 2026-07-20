---
name: bmc-adapter
default-enabled: false
---

# BMC 机型适配实战手册（adapter2 系）

本手册是「机型适配专家」助手的深度知识模块，覆盖「新增一个机型适配」时的可复用代码模式与检查清单。启用后，助手在 BMC / Redfish 适配任务中会主动套用这些模式。

## 何时使用
- 新增一个服务器机型的 BMC 适配（新 vendor / 新 platform）
- 给现有适配层补一个 BMC 能力（电源、温度、风扇、固件、事件订阅…）
- 排查机型兼容问题（字段缺失、类型漂移、会话过期、HTTPS 证书、分页）

## 标准 SOP（顺序不可跳）
1. 根探测：`GET /redfish/v1/` → 记录 `ProtocolFeatures` / 资源拓扑
2. 枚举 `Chassis` / `Systems` / `Managers` 及其 `Thermal` / `Power` / `Sensors`
3. 把厂商字段映射到适配层统一抽象接口
4. **读仓库里同类机型 adapter 作模板**（先 grep，再照写）
5. 实现可重试、会话自恢复的 HTTP 调用
6. 向后兼容：老机型不回归，新字段 null 容错
7. 验证：核心路径跑通（上电/下电、读温度、读固件版本、事件订阅）
8. 埋点：耗时 / 成功率 / 错误分类

## 可复用代码骨架（Java / Spring Boot 3）

### Redfish 客户端（会话自恢复 + 重试）
```java
@Component
public class RedfishClient {
    private final WebClient webClient;
    private final RedfishProps props; // 机型 -> baseUrl / user / password（来自配置/密钥，不硬编码）
    private String authToken;
    private Instant tokenExpireAt;

    public <T> T get(String path, Class<T> type) {
        return withRetry(() -> doGet(path, type));
    }

    private <T> T doGet(String path, Class<T> type) {
        if (needLogin()) login();
        try {
            return webClient.get().uri(props.baseUrl() + path)
                .header("X-Auth-Token", authToken)
                .header("OData-Version", "4.0")
                .retrieve().bodyToMono(type).block();
        } catch (WebClientResponseException.Unauthorized ex) {
            login(); // 会话过期，重登录后由外层 retry 重试
            throw ex;
        }
    }

    private void login() {
        // POST /redfish/v1/SessionService/Sessions，取 X-Auth-Token
        // 凭证来自配置/密钥管理，禁止明文写死
    }

    private boolean needLogin() {
        return authToken == null || Instant.now().isAfter(tokenExpireAt.minusSeconds(30));
    }

    private <T> T withRetry(Supplier<T> action) {
        // 指数退避重试：网络/401 重试并触发重登录；协议/业务错误不重试
    }
}
```

### 适配层接口（统一抽象 + 厂商实现）
```java
public interface BMCAdapter {
    PowerState getPowerState(String chassisId);
    List<TemperatureReading> getTemperatures(String chassisId);
    FirmwareInfo getFirmware(String managerId);
    void subscribeEvents(String destination); // EventService
}

// 每机型一个实现，命名与目录沿用既有约定（如 InspurBmcAdapter）
@Component
public class InspurBmcAdapter implements BMCAdapter { /* 照已有 adapter 写 */ }
```

### 配置驱动（机型 → endpoint 映射）
```yaml
bmc:
  adapters:
    inspur-nf5280m7:
      base-url: https://10.x.x.x/redfish/v1
      username: ${BMC_USER}      # 来自环境变量/密钥管理
      password: ${BMC_PASS}
    inspur-nf5280m6:
      base-url: https://10.y.y.y/redfish/v1
      username: ${BMC_USER}
      password: ${BMC_PASS}
```

## 陷阱检查清单（PR 前逐项确认）
- [ ] 真机/规范已探测，字段非凭记忆捏造
- [ ] 认证走配置/密钥，代码中无明文凭证
- [ ] 会话过期有自动重登录 + 重试
- [ ] 分页 `Members@odata.nextLink` 已处理
- [ ] HTTPS 自签证书已处理（关校验或预置信任）
- [ ] 新增字段对缺失/null 有容错
- [ ] 老机型 adapter 无回归
- [ ] 关键调用有埋点（耗时/成功率/错误分类）
- [ ] 核心路径有测试（真机或厂商 Redfish mock）

## 红线
- 不编造 Redfish 字段；不确定的先探测真机或查规范
- 不把凭证写进代码或日志
- 不破坏向后兼容
