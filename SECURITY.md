# 🔒 安全指南 - Security Guidelines

## ⚠️ 重要安全提醒

### 🚫 绝对禁止的操作

**永远不要将以下敏感信息提交到GitHub或任何公共代码仓库：**

- ❌ API密钥 (API Keys)
- ❌ 访问令牌 (Access Tokens)  
- ❌ 密码 (Passwords)
- ❌ 私钥文件 (.key, .pem, .p12, .pfx)
- ❌ 配置文件中的敏感信息
- ❌ 环境变量文件 (.env)

## 🔐 API密钥安全管理

### ✅ 正确的API密钥设置方式

#### 1. Cloudflare Pages 环境变量（推荐）

**步骤：**
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择您的 Pages 项目
3. 进入 **Settings** → **Environment variables**
4. 点击 **Add variable**
5. 设置：
   - **Variable name**: `AILABTOOLS_API_KEY`
   - **Value**: `your-actual-api-key-here`
   - **Environment**: 选择 `Production` 和 `Preview`
6. 点击 **Save**
7. 重新部署项目

**优势：**
- ✅ 密钥完全隐藏，不会出现在代码中
- ✅ 支持不同环境使用不同密钥
- ✅ 可以随时更新而无需修改代码
- ✅ 符合行业最佳安全实践

#### 2. 其他部署平台

**Vercel:**
```bash
# 使用Vercel CLI设置环境变量
vercel env add AILABTOOLS_API_KEY
```

**Netlify:**
1. 进入 Site settings → Environment variables
2. 添加 `AILABTOOLS_API_KEY` 变量

**GitHub Pages + GitHub Actions:**
1. 进入仓库 Settings → Secrets and variables → Actions
2. 添加 Repository secret: `AILABTOOLS_API_KEY`

### ❌ 错误的做法

```javascript
// ❌ 绝对不要这样做！
const API_KEY = "sk-1234567890abcdef"; // 直接写在代码中

// ❌ 也不要这样做！
this.apiKey = "your-real-api-key-here"; // 硬编码在源文件中

// ❌ 不要提交包含密钥的配置文件
const config = {
    apiKey: "real-api-key" // 这会被提交到Git
};
```

### ✅ 正确的代码实现

```javascript
// ✅ 正确的方式：从环境变量读取
getApiKey() {
    // 优先级1: Cloudflare Pages环境变量
    if (typeof AILABTOOLS_API_KEY !== 'undefined') {
        return AILABTOOLS_API_KEY;
    }
    
    // 优先级2: Node.js环境变量
    if (typeof process !== 'undefined' && process.env.AILABTOOLS_API_KEY) {
        return process.env.AILABTOOLS_API_KEY;
    }
    
    // 优先级3: 本地存储（仅用于测试）
    const stored = localStorage.getItem('ailabtools_api_key');
    if (stored) return stored;
    
    return ''; // 没有找到密钥
}
```

## 🛡️ .gitignore 安全配置

确保以下文件类型被正确忽略：

```gitignore
# 环境变量文件
.env
.env.local
.env.production
.env.development
.env.*.local

# API密钥和敏感数据
api-keys.txt
ailabtools-api-key.txt
*.key
*.pem
*.p12
*.pfx
api-config.js
secrets.js
config.json
secrets.json

# 临时配置文件
temp-config.js
local-settings.json
```

## 🔍 安全检查清单

### 提交代码前检查

- [ ] 没有硬编码的API密钥
- [ ] 没有密码或访问令牌
- [ ] .env文件已被.gitignore忽略
- [ ] 配置文件不包含敏感信息
- [ ] 测试文件不包含真实密钥

### 部署前检查

- [ ] 环境变量已在部署平台设置
- [ ] API密钥权限最小化
- [ ] 生产环境使用独立的API密钥
- [ ] 定期轮换API密钥

## 🚨 如果意外提交了敏感信息

### 立即行动步骤

1. **撤销API密钥**
   - 立即在AILabTools控制台撤销泄露的密钥
   - 生成新的API密钥

2. **清理Git历史**
   ```bash
   # 从所有历史记录中删除敏感文件
   git filter-branch --force --index-filter \
   'git rm --cached --ignore-unmatch path/to/sensitive-file' \
   --prune-empty --tag-name-filter cat -- --all
   
   # 强制推送到远程仓库
   git push origin --force --all
   ```

3. **更新密钥**
   - 在部署平台设置新的环境变量
   - 重新部署应用

## 🔒 最佳安全实践

### 开发环境

1. **使用测试API密钥**
   - 为开发环境使用单独的API密钥
   - 限制测试密钥的权限和配额

2. **本地环境变量**
   ```bash
   # 创建 .env.local 文件（已被gitignore）
   echo "AILABTOOLS_API_KEY=your-test-api-key" > .env.local
   ```

3. **代码审查**
   - 每次Pull Request都要检查敏感信息
   - 使用自动化工具扫描密钥泄露

### 生产环境

1. **环境隔离**
   - 生产和开发使用不同的API密钥
   - 定期轮换生产环境密钥

2. **访问控制**
   - 限制API密钥的访问权限
   - 监控API使用情况

3. **审计日志**
   - 记录API密钥的使用情况
   - 定期审查访问日志

## 📞 安全问题报告

如果您发现安全漏洞，请通过以下方式报告：

- 📧 **安全邮箱**: security@aismile.online
- 🔒 **加密通信**: 使用PGP加密敏感信息
- ⏱️ **响应时间**: 我们将在24小时内回复

### 负责任的披露

请遵循负责任的披露原则：
1. 不要公开披露漏洞细节
2. 给我们合理的时间修复问题
3. 不要利用漏洞进行恶意活动

## 🏆 安全认证

我们的安全实践符合以下标准：
- ✅ OWASP安全开发生命周期
- ✅ GDPR数据保护要求
- ✅ SOC 2 Type II控制要求

---

**记住：安全是每个人的责任！** 🛡️

如有任何安全相关问题，请随时联系我们。 