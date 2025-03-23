document.addEventListener('DOMContentLoaded', () => {
  const registrationForm = document.getElementById('registration-form');
  const chatInterface = document.getElementById('chat-interface');
  const usernameInput = document.getElementById('username-input');
  const registerBtn = document.getElementById('register-btn');
  const registerError = document.getElementById('register-error');
  const currentUsername = document.getElementById('current-username');
  const roomsList = document.getElementById('rooms-list');
  const usersList = document.getElementById('users-list');
  const chatMessages = document.getElementById('chat-messages');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const newRoomInput = document.getElementById('new-room-input');
  const createRoomBtn = document.getElementById('create-room-btn');
  const createRoomError = document.getElementById('create-room-error');
  const currentRoomHeader = document.getElementById('current-room');
  const privateMessageForm = document.getElementById('private-message-form');
  const privateRecipient = document.getElementById('private-recipient');
  const privateMessageInput = document.getElementById('private-message-input');
  const sendPrivateBtn = document.getElementById('send-private-btn');
  const closePrivateBtn = document.getElementById('close-private-btn');

  const socket = io();

  let currentRoom = 'general';
  let username = '';
  let selectedPrivateUser = '';

  // Реєстрація користувача
  registerBtn.addEventListener('click', () => {
      const name = usernameInput.value.trim();
      if (name.length < 3) {
          registerError.textContent = 'Ім\'я має містити принаймні 3 символи';
          return;
      }
      
      socket.emit('register', name);
  });

  // Натискання Enter для входу
  usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
          registerBtn.click();
      }
  });

  // Відповідь на реєстрацію
  socket.on('register_success', (name) => {
      username = name;
      currentUsername.textContent = name;
      registrationForm.classList.add('hidden');
      chatInterface.classList.remove('hidden');
      updateUsersAndRooms();
  });

  socket.on('register_error', (message) => {
      registerError.textContent = message;
  });

  // Оновлення списку кімнат
  socket.on('room_update', (rooms) => {
      roomsList.innerHTML = '';
      rooms.forEach(room => {
          const li = document.createElement('li');
          li.textContent = room === 'general' ? 'Загальний чат' : 
                        room === 'support' ? 'Підтримка' : 
                        room === 'another' ? 'Інше' : room;
          li.dataset.room = room;
          if (room === currentRoom) {
              li.classList.add('active');
          }
          li.addEventListener('click', () => {
              joinRoom(room);
          });
          roomsList.appendChild(li);
      });
  });

  // Завантаження історії повідомлень
  socket.on('load_messages', (messages) => {
      chatMessages.innerHTML = '';
      messages.forEach(message => {
          appendMessage(message);
      });
      scrollToBottom();
  });

  // Користувач приєднався
  socket.on('user_joined', (data) => {
      updateUsersList(data.users);
      
      // Якщо в тій самій кімнаті, додаємо системне повідомлення
      if (data.room === currentRoom && data.username !== username) {
          const systemMessage = {
              text: `${data.username} приєднався до чату`,
              isSystem: true
          };
          appendMessage(systemMessage);
          scrollToBottom();
      }
  });

  // Користувач відключився
  socket.on('user_left', (data) => {
      updateUsersList(data.users);
      
      // Якщо в тій самій кімнаті, додаємо системне повідомлення
      if (data.room === currentRoom) {
          const systemMessage = {
              text: `${data.username} покинув чат`,
              isSystem: true
          };
          appendMessage(systemMessage);
          scrollToBottom();
      }
  });

  // Нове повідомлення
  socket.on('new_message', (message) => {
      if (message.room === currentRoom) {
          appendMessage(message);
          scrollToBottom();
      }
  });

  // Приватне повідомлення
  socket.on('private_message', (message) => {
      appendMessage({
          ...message,
          isPrivate: true
      });
      scrollToBottom();
  });

  // Створення нової кімнати
  socket.on('room_created', (roomName) => {
      joinRoom(roomName);
  });

  // Надсилання повідомлення
  sendBtn.addEventListener('click', () => {
      sendMessage();
  });

  messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
          sendMessage();
      }
  });

  // Обробка створення нової кімнати
  createRoomBtn.addEventListener('click', () => {
    const roomName = newRoomInput.value.trim();
    if (roomName.length < 3) {
        createRoomError.textContent = 'Назва кімнати має містити принаймні 3 символи';
        createRoomError.style.display = 'block';
        return;
    }
    createRoomError.style.display = 'none';
    socket.emit('create_room', roomName);
    newRoomInput.value = '';
  });

  newRoomInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        createRoomBtn.click();
    }
  });

  // Обробка приватних повідомлень
  sendPrivateBtn.addEventListener('click', () => {
      sendPrivateMessage();
  });

  privateMessageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
          sendPrivateMessage();
      }
  });

  closePrivateBtn.addEventListener('click', () => {
      privateMessageForm.classList.add('hidden');
      selectedPrivateUser = '';
  });

  // Функції

  function sendMessage() {
      const text = messageInput.value.trim();
      if (text) {
          socket.emit('send_message', { text, room: currentRoom });
          messageInput.value = '';
      }
  }

  function sendPrivateMessage() {
      const text = privateMessageInput.value.trim();
      if (text && selectedPrivateUser) {
          socket.emit('private_message', { 
              to: selectedPrivateUser, 
              text: text 
          });
          privateMessageInput.value = '';
          privateMessageForm.classList.add('hidden');
      }
  }

  function joinRoom(room) {
      if (room === currentRoom) return;
      socket.emit('join_room', room);
      currentRoom = room;
      currentRoomHeader.textContent = room === 'general' ? 'Загальний чат' : 
                                   room === 'support' ? 'Підтримка' : 
                                   room === 'another' ? 'Інше' : room;
      updateRoomsList();
  }

  function appendMessage(message) {
      const messageElement = document.createElement('div');
      messageElement.classList.add('message');

      if (message.isSystem) {
          messageElement.classList.add('system-message');
          messageElement.innerHTML = `<div class="text">${message.text}</div>`;
      } else if (message.isPrivate) {
          messageElement.classList.add('private-message');
          messageElement.innerHTML = `
              <div class="header">
                  <span class="username">${message.from}</span>
                  <span class="time">${message.time}</span>
              </div>
              <div class="text">${message.text}</div>
          `;
      } else {
          if (message.username === username) {
              messageElement.classList.add('my-message');
          } else {
              messageElement.classList.add('other-message');
          }
          messageElement.innerHTML = `
              <div class="header">
                  <span class="username">${message.username}</span>
                  <span class="time">${message.time}</span>
              </div>
              <div class="text">${message.text}</div>
          `;
      }

      chatMessages.appendChild(messageElement);
  }

  function updateRoomsList() {
      const roomItems = roomsList.querySelectorAll('li');
      roomItems.forEach(item => {
          if (item.dataset.room === currentRoom) {
              item.classList.add('active');
          } else {
              item.classList.remove('active');
          }
      });
  }

  function updateUsersList(users) {
      usersList.innerHTML = '';
      users.forEach(user => {
          const li = document.createElement('li');
          li.textContent = user;
          li.addEventListener('click', () => {
              selectedPrivateUser = user;
              privateRecipient.textContent = user;
              privateMessageForm.classList.remove('hidden');
          });
          usersList.appendChild(li);
      });
  }

  function scrollToBottom() {
      chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function updateUsersAndRooms() {
      socket.emit('get_users');
  }
});