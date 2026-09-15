# 🐍 霓虹贪吃蛇 Neon Snake（GitHub + Vercel 部署版）

按《草履虫也懂的 Vibe Coding 部署课》的方案做的第二个纯静态网页小游戏。
玩法跟经典贪吃蛇一样，但界面/特效升级了：**平滑移动、霓虹蛇身、发光食物、吃食粒子特效、音效、难度选择**，最高分用 `localStorage` 记住。

老师要求：纯 HTML 静态项目 → 推到 GitHub → Vercel 一键部署 → 免费拿到 `xxx.vercel.app` 门牌号。

## 一、本地怎么玩

直接双击 `index.html` 即可在浏览器里玩。

- 电脑：方向键 / WASD 移动，空格暂停
- 手机：在画面上滑动控制方向（可发微信在手机上打开）
- 吃到 🍎 +10 分；撞墙或撞自己即结束
- 右上角 🔊 可开关音效；下方可切 简单 / 普通 / 困难

## 二、按老师方案部署（GitHub + Vercel）

### 第 1 步：把代码传到 GitHub

打开 PowerShell（右键开始菜单 → 终端 / Windows PowerShell），依次输入：

```powershell
# 1. 进入贪吃蛇2文件夹（在桌面）
cd Desktop
cd 贪吃蛇2

# 2. 这里变成 Git 仓库
git init

# 3. 打包所有文件
git add .

# 4. 写备注（贴快递单）
git commit -m "我的霓虹贪吃蛇"

# 5. 连接你的 GitHub 仓库（已按你的账号 ydum23 设好）
git remote add origin https://github.com/ydum23/snake2.git

# 6. 发车！
git push -u origin main
```

> ⚠️ 常见翻车点：
> - **推送前先去 github.com 点 New 新建一个空仓库**，名字填 `snake2`（**不要**勾选 Add a README / .gitignore），否则 `git push` 会报仓库不存在
> - 执行 `git push` 时会**弹出浏览器让你授权**，点 **Authorize** 登录即可（这就是老师说的"一键登录"）
> - 提示 `failed to push`：先检查远程仓库地址是否打错
> - 分支名是 `master` 不是 `main`：先 `git branch -M main` 再 push

### 第 2 步：Vercel 一键上线

1. 打开 [vercel.com](https://vercel.com) → Sign Up → **Continue with GitHub** 登录
2. 点 **Add New Project** → 找到你的 `snake2` 仓库 → **Import**
3. 配置 Framework：**因为是纯 HTML，Framework Preset 选 "Other"**（不要选 Next.js）
4. 点 **Deploy** → 等约 1 分钟 → 🎉 拿到 `xxx.vercel.app` 网址

✅ 成功标志：把 `xxx.vercel.app` 发到手机微信，点开能玩，就说明真的上线了！

## 三、文件说明

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面结构（Vercel 入口） |
| `style.css`  | 霓虹玻璃拟态样式 |
| `game.js`    | 游戏逻辑（Canvas 渲染、平滑插值、粒子、音效、计分） |

## 四、可拓展（选做）

- 想跨设备记住最高分 → 需要数据库（老师这节课不碰，但要知道这个概念）
- 想自定义域名 `xxx.com`（约 60 元/年）→ 在 Vercel 里做域名解析
