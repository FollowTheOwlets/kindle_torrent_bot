/**
 * Хранилище email-адресов пользователей.
 * In-memory Map: tgId → email.
 *
 * @example
 * const repo = new UserRepo();
 * repo.setEmail(123, 'user@example.com');
 * const email = repo.getEmail(123);
 */
export class UserRepo {
    private emails = new Map<number, string>();

    /**
     * Сохранить/обновить email для пользователя.
     * @param {number} tgId Telegram ID пользователя.
     * @param {string} email Адрес электронной почты.
     */
    setEmail(tgId: number, email: string) {
        this.emails.set(tgId, email);
    }

    /**
     * Получить email пользователя.
     * @param {number} tgId Telegram ID пользователя.
     * @returns {string|undefined} Email или undefined, если не найден.
     */
    getEmail(tgId: number): string | undefined {
        return this.emails.get(tgId);
    }
}
