import {ChatMessage} from '../lib/core/entity/chat';

export const CHAT_MOCK: ChatMessage[] = [
    new ChatMessage(1, 1, '2023-10-30T23:01:00', 'incoming', 'Lola', 'Вітаю', null, null, false),
    new ChatMessage(2, 1, '2023-10-30T23:01:00', 'outgoing', 'Alex', 'Доброго дня. Я ваш віртуальний помічник.', null, null, true),
    new ChatMessage(3, 1, '2023-10-30T23:01:00', 'incoming', 'Lola', 'нема інтернету', null, null, true),
    new ChatMessage(4, 1, '2023-10-30T23:01:00', 'outgoing', 'Alex', 'Вибачте, я не зовсім зрозуміла ваше запитання. Будь ласка, уточніть, чим я можу вам допомогти?', null, null, false),
    new ChatMessage(5, 1, '2023-10-30T23:01:00', 'incoming', 'Lola', 'test', null, null, false),
    new ChatMessage(6, 1, '2023-10-30T23:03:00', 'incoming', 'Lola', 'test', null, null, false),
    new ChatMessage(7, 1, '2023-10-30T23:03:00', 'incoming', 'Lola', 'test', null, null, false),
    new ChatMessage(8, 1, '2023-10-30T23:04:00', 'incoming', 'Lola', 'test', null, null, false),
    new ChatMessage(9, 1, '2023-10-30T23:05:00', 'incoming', 'Lola', 'test qq', null, null, false),
    new ChatMessage(10, 1, '2023-10-30T23:05:00', 'incoming', 'Lola', 'test q', null, null, false),
    new ChatMessage(11, 1, '2023-10-30T23:05:00', 'incoming', 'Lola', 'test q', null, '../../assets/img/img1.jpg, ../../assets/img/img2.jpg', false),
    new ChatMessage(12, 1, '2023-10-30T23:05:00', 'outgoing', 'Alex', 'Вибачте, я не зовсім зрозуміла ваше запитання. Будь ласка, уточніть, чим я можу вам допомогти? Вибачте, я не зовсім зрозуміла ваше запитання. Будь ласка, уточніть, чим я можу вам допомогти? Вибачте, я не зовсім зрозуміла ваше запитання. Будь ласка, уточніть, чим я можу вам допомогти?', null, null, false),
    new ChatMessage(13, 1, '2023-10-30T23:06:00', 'outgoing', 'Alex', 'test qwe', '../../assets/img/img2.jpg', null, false),
    new ChatMessage(14, 1, '2023-09-30T11:02:00', 'outgoing', 'Alex', 'Вибачте, я не зовсім зрозуміла ваше запитання. Будь ласка, уточніть, чим я можу вам допомогти? Вибачте, я не зовсім зрозуміла ваше запитання. Будь ласка, уточніть, чим я можу вам допомогти? Вибачте, я не зовсім зрозуміла ваше запитання. Будь ласка, уточніть, чим я можу вам допомогти? Будь ласка, уточніть, чим я можу вам допомогти?', '../../assets/img/img2.jpg', null, false),
];


