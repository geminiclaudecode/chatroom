const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ---------- 静态文件 ----------
app.use(express.static(path.join(__dirname, 'public')));

// ---------- 治愈系匿名花名池（昵称为空时的后备方案）----------
const FLOWER_NAMES = [
  '凌晨三点的猫',
  '迷路的向日葵',
  '宇宙边缘的宇航员',
  '失眠的鲸鱼',
  '月亮背面的兔子',
  '深海里的萤火虫',
  '第七次日落',
  '北极星的眼泪',
  '会飞的金鱼',
  '雨中跳舞的刺猬',
  '黄昏便利店',
  '银河铁道乘务员',
  '星尘收集者',
  '樱花飘落的速度',
  '风居住的街道',
  '被遗忘的邮筒',
  '云朵上的面包师',
  '旧唱片里的杂音',
  '半糖去冰的月亮',
  '平行世界的另一个我'
];

const usedNames = new Set();

function getRandomName() {
  const available = FLOWER_NAMES.filter(n => !usedNames.has(n));
  if (available.length === 0) {
    usedNames.clear();
    return getRandomName();
  }
  const name = available[Math.floor(Math.random() * available.length)];
  usedNames.add(name);
  return name;
}

function releaseName(name) {
  // 只释放花名池里的名字，用户自定义昵称不追踪
  if (FLOWER_NAMES.includes(name)) {
    usedNames.delete(name);
  }
}

// ---------- 格式化时间戳 ----------
function formatTime() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

// ---------- 昵称合法性检查 ----------
function sanitizeNickname(raw) {
  if (!raw || typeof raw !== 'string') return '';
  // 去除首尾空白，限制长度为 20 个字符
  let name = raw.trim().slice(0, 20);
  // 过滤掉纯空白或太短的昵称
  if (name.length === 0) return '';
  // 移除 HTML 标签，防止富文本注入
  name = name.replace(/<[^>]*>/g, '');
  // 再次检查长度
  return name.trim().slice(0, 20);
}

// ---------- Socket.io 核心逻辑 ----------
const ROOM_ID = 'public-room';

io.on('connection', (socket) => {
  let hasJoined = false;
  let nickname = '';

  // 后端控制台日志
  console.log(`\x1b[90m[连接]\x1b[0m 新客户端已连接 (${socket.id})`);

  // ---------- 加入聊天室（客户端发送昵称后触发）----------
  socket.on('join', (data) => {
    if (hasJoined) return; // 防止重复加入

    const rawNickname = data && data.nickname ? data.nickname : '';
    const sanitized = sanitizeNickname(rawNickname);

    // 如果用户填了有效昵称就用它，否则从花名池随机分配
    if (sanitized) {
      nickname = sanitized;
    } else {
      nickname = getRandomName();
    }

    hasJoined = true;
    socket.nickname = nickname;

    // 加入公共聊天室
    socket.join(ROOM_ID);

    console.log(`\x1b[36m[系统]\x1b[0m ${nickname} \x1b[32m悄悄进入了树洞\x1b[0m`);

    // 告知客户端他自己的昵称
    socket.emit('welcome', {
      nickname,
      usedCount: io.sockets.adapter.rooms.get(ROOM_ID)?.size || 0
    });

    // 通知全体：有人进来了
    io.to(ROOM_ID).emit('message', {
      type: 'system',
      nickname: '树洞小精灵',
      content: `${nickname} 悄悄走进了树洞 🌿`,
      time: formatTime()
    });

    // 更新在线人数
    io.to(ROOM_ID).emit('onlineCount', {
      count: io.sockets.adapter.rooms.get(ROOM_ID)?.size || 0
    });
  });

  // ---------- 接收消息并广播 ----------
  socket.on('chatMessage', (data) => {
    if (!hasJoined) return;

    const content = (data && data.content ? String(data.content).trim() : '').slice(0, 500);
    if (!content) return;

    const msg = {
      type: 'chat',
      nickname: socket.nickname,
      content,
      time: formatTime()
    };
    // 广播给房间内所有人（包括发送者自己）
    io.to(ROOM_ID).emit('message', msg);
  });

  // ---------- 断开连接 ----------
  socket.on('disconnect', () => {
    if (!hasJoined) {
      console.log(`\x1b[90m[连接]\x1b[0m 未命名的客户端已断开 (${socket.id})`);
      return;
    }

    releaseName(socket.nickname);
    console.log(`\x1b[36m[系统]\x1b[0m ${socket.nickname} \x1b[31m悄悄离开了树洞\x1b[0m`);

    io.to(ROOM_ID).emit('message', {
      type: 'system',
      nickname: '树洞小精灵',
      content: `${socket.nickname} 悄悄离开了树洞 🍂`,
      time: formatTime()
    });

    io.to(ROOM_ID).emit('onlineCount', {
      count: io.sockets.adapter.rooms.get(ROOM_ID)?.size || 0
    });
  });
});

// ---------- 启动服务 ----------
const PORT = 3000;
server.listen(PORT, () => {
  console.log('');
  console.log('  🌲 ================================');
  console.log('     五湖四海实时聊天室 已启动 ✨');
  console.log(`     本地地址: \x1b[4mhttp://localhost:${PORT}\x1b[0m`);
  console.log('  🌲 ================================');
  console.log('');
});
