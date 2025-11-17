import {ChatMessage} from '../app/core/entity/chat';

export const CHAT_MESSAGE_MOCK: ChatMessage = new ChatMessage({
    id: 11,
    chat_id: 1,
    cr_time: '2025-11-17 17:46:00',
    type: 'incoming',
    user: 'Lola',
    content: 'lorem ipsum dolar',
    avatar: null,
    file_path: null,
    checked: false
})

export const CHAT_MESSAGE_SECOND_MOCK: ChatMessage = new ChatMessage({
    id: 12,
    chat_id: 1,
    cr_time: '2025-11-17T17:47:00',
    type: 'incoming',
    user: 'Lola',
    content: 'qwe - test',
    avatar: null,
    file_path: null,
    checked: false
})

export const CHAT_MESSAGE_THIRD_MOCK: ChatMessage = new ChatMessage({
    id: 13,
    chat_id: 1,
    cr_time: '2025-11-17T17:49:00',
    type: 'incoming',
    user: 'Lola',
    content: 'qwe test qwe-qwe, test test qwe qwe test',
    avatar: null,
    file_path: null,
    checked: false
})

export const CHAT_MOCK: ChatMessage[] = [
    new ChatMessage({
        id: 1,
        chat_id: 1,
        cr_time: '2023-10-24T08:00:00',
        type: 'incoming',
        user: 'Lola',
        content: 'Hello',
        avatar: null,
        file_path: null,
        checked: false
    }),
    new ChatMessage({
        id: 2,
        chat_id: 1,
        cr_time: '2023-10-30T23:01:00',
        type: 'outgoing',
        user: 'Alex',
        content: 'Good afternoon. I am your virtual assistant.',
        avatar: null,
        file_path: null,
        checked: true
    }),
    new ChatMessage({
        id: 3,
        chat_id: 1,
        cr_time: '2023-10-30T23:01:00',
        type: 'incoming',
        user: 'Lola',
        content: 'no connection',
        avatar: null,
        file_path: null,
        checked: true
    }),
    new ChatMessage({
        id: 4,
        chat_id: 1,
        cr_time: '2023-10-30T23:01:00',
        type: 'outgoing',
        user: 'Alex',
        content: 'Sorry, I didn\'t quite understand your question. Please clarify how I can help you?',
        avatar: null,
        file_path: null,
        checked: true
    }),
    new ChatMessage({
        id: 5,
        chat_id: 1,
        cr_time: '2023-10-30T23:05:00',
        type: 'incoming',
        user: 'Lola',
        content: 'test test test',
        avatar: null,
        file_path: null,
        checked: true
    }),
    new ChatMessage({
        id: 6,
        chat_id: 1,
        cr_time: '2023-10-30T23:05:00',
        type: 'incoming',
        user: 'Lola',
        content: 'test q',
        avatar: null,
        file_path: ['/assets/img/user_4.jpg', '/assets/img/user_5.jpg'],
        checked: true
    }),
    new ChatMessage({
        id: 7,
        chat_id: 1,
        cr_time: '2023-10-30T23:05:00',
        type: 'outgoing',
        user: 'Alex',
        content: 'Вибачте, я не зовсім зрозуміла ваше запитання. Будь ласка, уточніть, чим я можу вам допомогти? Вибачте, я не зовсім зрозуміла ваше запитання. Будь ласка, уточніть, чим я можу вам допомогти? Вибачте, я не зовсім зрозуміла ваше запитання. Будь ласка, уточніть, чим я можу вам допомогти?',
        avatar: null,
        file_path: null,
        checked: true
    }),
    new ChatMessage({
        id: 8,
        chat_id: 1,
        cr_time: '2023-10-30T23:06:00',
        type: 'outgoing',
        user: 'Alex',
        content: 'test qwe',
        avatar: null,
        file_path: ['../../assets/img/img2.jpg'],
        checked: true
    }),
    new ChatMessage({
        id: 9,
        chat_id: 1,
        cr_time: '2023-09-30T11:02:00',
        type: 'outgoing',
        user: 'Alex',
        content: 'Вибачте, я не зовсім зрозуміла ваше запитання. Будь ласка, уточніть, чим я можу вам допомогти? Вибачте, я не зовсім зрозуміла ваше запитання. Будь ласка, уточніть, чим я можу вам допомогти? Вибачте, я не зовсім зрозуміла ваше запитання. Будь ласка, уточніть, чим я можу вам допомогти? Будь ласка, уточніть, чим я можу вам допомогти?',
        avatar: null,
        file_path: ['../../assets/img/img2.jpg'],
        checked: false
    }),
];
