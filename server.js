const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

// Зберігання даних у пам'яті
const users = {};
const rooms = {
  'general': { users: [], messages: [] },
  'support': { users: [], messages: [] },
  'another': { users: [], messages: [] }
};

// Максимальна кількість повідомлень для зберігання історії
const MAX_MESSAGES = 50;

io.on('connection', (socket) => {
  console.log('Новий користувач підключився');
  let currentUser = null;
  let currentRoom = 'general';

  // Реєстрація користувача
  socket.on('register', (username) => {
    if (Object.values(users).includes(username)) {
      socket.emit('register_error', 'Це ім\'я вже використовується. Будь ласка, оберіть інше.');
      return;
    }
    
    currentUser = username;
    users[socket.id] = username;
    socket.join('general'); // За замовчуванням приєднуємо до загальної кімнати
    rooms['general'].users.push(username);
    
    socket.emit('register_success', username);
    socket.emit('room_update', Object.keys(rooms));
    socket.emit('load_messages', rooms['general'].messages);
    
    // Повідомлення всім користувачам про нового учасника
    io.to('general').emit('user_joined', { 
      username: username, 
      users: rooms['general'].users,
      room: 'general'
    });
  });

  // Надсилання повідомлення
  socket.on('send_message', (data) => {
    if (!currentUser) return;
    
    const messageData = {
      username: currentUser,
      text: data.text,
      time: new Date().toLocaleTimeString(),
      room: data.room
    };
    
    // Зберігаємо повідомлення в історію кімнати
    rooms[data.room].messages.push(messageData);
    if (rooms[data.room].messages.length > MAX_MESSAGES) {
      rooms[data.room].messages.shift();
    }
    
    // Надсилаємо повідомлення всім користувачам у кімнаті
    io.to(data.room).emit('new_message', messageData);
  });

  // Приватне повідомлення
  socket.on('private_message', (data) => {
    if (!currentUser) return;
    
    const targetSocketId = Object.keys(users).find(key => users[key] === data.to);
    
    if (targetSocketId) {
      const messageData = {
        from: currentUser,
        text: data.text,
        time: new Date().toLocaleTimeString(),
        isPrivate: true
      };
      
      // Надсилаємо повідомлення відправнику і отримувачу
      socket.emit('private_message', messageData);
      io.to(targetSocketId).emit('private_message', messageData);
    } else {
      socket.emit('error', 'Користувача не знайдено');
    }
  });

  // Зміна кімнати
  socket.on('join_room', (room) => {
    if (!currentUser || !rooms[room]) return;
    
    // Видаляємо користувача з поточної кімнати
    socket.leave(currentRoom);
    const index = rooms[currentRoom].users.indexOf(currentUser);
    if (index !== -1) {
      rooms[currentRoom].users.splice(index, 1);
    }
    
    // Повідомляємо всіх у попередній кімнаті
    io.to(currentRoom).emit('user_left', {
      username: currentUser,
      users: rooms[currentRoom].users,
      room: currentRoom
    });
    
    // Додаємо до нової кімнати
    currentRoom = room;
    socket.join(room);
    rooms[room].users.push(currentUser);
    
    // Надсилаємо історію повідомлень нової кімнати
    socket.emit('load_messages', rooms[room].messages);
    
    // Повідомляємо всіх у новій кімнаті
    io.to(room).emit('user_joined', {
      username: currentUser,
      users: rooms[room].users,
      room: room
    });
  });

  // Створення нової кімнати
  socket.on('create_room', (roomName) => {
    if (!currentUser || rooms[roomName]) return;
    
    rooms[roomName] = { users: [], messages: [] };
    io.emit('room_update', Object.keys(rooms));
    
    // Автоматично приєднуємо користувача до нової кімнати
    socket.emit('room_created', roomName);
  });

  // Отримання списку користувачів
  socket.on('get_users', () => {
    socket.emit('users_list', Object.values(users));
  });

  // Відключення користувача
  socket.on('disconnect', () => {
    if (currentUser) {
      // Видаляємо користувача з поточної кімнати
      const index = rooms[currentRoom].users.indexOf(currentUser);
      if (index !== -1) {
        rooms[currentRoom].users.splice(index, 1);
      }
      
      // Повідомляємо всіх у кімнаті
      io.to(currentRoom).emit('user_left', {
        username: currentUser,
        users: rooms[currentRoom].users,
        room: currentRoom
      });
      
      // Видаляємо зі списку активних користувачів
      delete users[socket.id];
      console.log(`Користувач ${currentUser} відключився`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});