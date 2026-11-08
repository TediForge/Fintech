const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDate(value: Date | number | string | null | undefined): Date | null {
    if (value == null || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function ordinalSuffix(day: number): string {
    if (day % 100 >= 11 && day % 100 <= 13) return 'th';
    return ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] ?? 'th';
}

export function formatDate(value: Date | number | string | null | undefined): string {
    const date = parseDate(value);
    if (!date) return '';
    const day = date.getDate();
    return `${MONTH_NAMES[date.getMonth()]} ${day}${ordinalSuffix(day)}, ${date.getFullYear()}`;
}

export function formatTime(value: Date | number | string | null | undefined): string {
    const date = parseDate(value);
    if (!date) return '';
    const hour = date.getHours() % 12 || 12;
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hour}:${minutes} ${date.getHours() >= 12 ? 'PM' : 'AM'}`;
}

export function formatDateTime(value: Date | number | string | null | undefined): string {
    const date = formatDate(value);
    const time = formatTime(value);
    return [date, time].filter(Boolean).join(' ');
}

export function truncateText(value: string, maxLength = 30): string {
    if (value.length <= maxLength) return value;
    if (maxLength <= 3) return '.'.repeat(Math.max(0, maxLength));
    return `${value.slice(0, maxLength - 3)}...`;
}

export function formatCurrency(value: number, currency = 'NGN', locale = 'en-NG'): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

export function formatNumber(value: number, locale = 'en-NG'): string {
    return new Intl.NumberFormat(locale).format(value);
}

export function formatCompactNumber(value: number, locale = 'en-NG'): string {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function formatPercentage(value: number, fractionDigits = 1): string {
    return `${new Intl.NumberFormat('en-NG', { maximumFractionDigits: fractionDigits }).format(value)}%`;
}

export function capitalize(value: string): string {
    return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

export function capitalizeWords(value: string): string {
    return value.replace(/\b\p{L}/gu, (character) => character.toUpperCase());
}

export function formatInitials(value: string): string {
    return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join('');
}

export function formatPhoneNumber(value: string): string {
    return value.trim().replace(/[().-]/g, '').replace(/\s+/g, ' ');
}

export type CountryForPhone = {
    isoCode?: string;
    countryCode?: string;
    name?: string;
    dialCode?: string;
};

const onlyDigits = (value: unknown): string => String(value || '').replace(/\D/g, '');
const normalizeSelection = (selection: unknown): string => String(selection || '').trim();

const findPhoneCountry = (selection: unknown, countries: CountryForPhone[]): CountryForPhone | null => {
    if (!Array.isArray(countries) || countries.length === 0 || !selection) return null;
    if (typeof selection === 'object') {
        const value = selection as CountryForPhone;
        selection = value.isoCode || value.countryCode || value.name || value.dialCode;
        if (!selection) return null;
    }

    const text = normalizeSelection(selection);
    const upper = text.toUpperCase();
    const numeric = onlyDigits(text);
    return countries.find((country) => country.isoCode?.toUpperCase() === upper)
        || countries.find((country) => country.countryCode?.toUpperCase() === upper)
        || countries.find((country) => country.name?.toUpperCase() === upper)
        || countries.find((country) => onlyDigits(country.dialCode) === numeric)
        || countries.find((country) => String(country.dialCode).trim() === text)
        || null;
};

export async function getCountryDialCode(
    countrySelection: unknown,
    countries: CountryForPhone[],
): Promise<string> {
    const country = findPhoneCountry(countrySelection, countries);
    if (!country?.dialCode) throw new Error('The selected country is not supported.');
    return String(country.dialCode);
}

export async function detectCountryFromPhone(
    phone: string,
    countries: CountryForPhone[],
): Promise<string | null> {
    const digits = onlyDigits(normalizeSelection(phone));
    if (!digits) return null;
    const candidates = countries
        .filter((country) => country.dialCode)
        .sort((a, b) => onlyDigits(b.dialCode).length - onlyDigits(a.dialCode).length);
    for (const country of candidates) {
        const dialDigits = onlyDigits(country.dialCode);
        if (dialDigits && digits.startsWith(dialDigits)) return country.isoCode || country.countryCode || null;
    }
    return null;
}

export async function normalizePhoneNumber(
    phone: string,
    countrySelection: unknown,
    countries: CountryForPhone[],
    strict = false,
): Promise<string> {
    const cleanPhone = normalizeSelection(phone);
    if (!cleanPhone) throw new Error('Phone number is required.');
    const digits = onlyDigits(cleanPhone);
    if (!digits) throw new Error('Phone number is invalid.');

    let country = findPhoneCountry(countrySelection, countries);
    let detectedCountry: string | null = null;
    if (!country && typeof countrySelection === 'string') {
        detectedCountry = await detectCountryFromPhone(cleanPhone, countries);
        country = findPhoneCountry(detectedCountry, countries);
    }
    if (!country?.dialCode) throw new Error('The selected country is not supported.');

    const dialCode = String(country.dialCode).trim();
    const dialDigits = onlyDigits(dialCode);
    if (!dialDigits) throw new Error('The selected country does not have a dialing code configured.');
    if (cleanPhone.startsWith('+')) {
        const normalized = `+${digits}`;
        if (strict && !digits.startsWith(dialDigits)) {
            throw new Error('The phone number dialing code does not match the selected country.');
        }
        return normalized;
    }
    if (digits.startsWith(dialDigits)) return `+${digits}`;

    const localDigits = digits.replace(/^0+/, '');
    const normalized = `+${dialDigits}${localDigits}`;
    if (normalized === `+${dialDigits}`) throw new Error('Phone number is invalid.');
    return normalized;
}

export async function getPhoneLookupCandidates(
    phone: string,
    countrySelection: unknown,
    countries: CountryForPhone[],
): Promise<string[]> {
    const candidates: string[] = [];
    const normalizedDigits = onlyDigits(phone);
    const selectedCountry = findPhoneCountry(countrySelection, countries);
    const detectedCountry = await detectCountryFromPhone(phone, countries);
    for (const countryCode of [detectedCountry, selectedCountry?.isoCode || selectedCountry?.countryCode, 'NG']) {
        if (!countryCode) continue;
        try {
            candidates.push(await normalizePhoneNumber(phone, countryCode, countries, false));
        } catch {
            continue;
        }
    }
    if (normalizedDigits) {
        candidates.push(normalizedDigits, `0${normalizedDigits.replace(/^0+/, '')}`);
    }
    return Array.from(new Set(candidates.filter(Boolean)));
}

export function formatFileSize(bytes: number): string {
    if (bytes < 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = bytes / 1024;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    return `${Number(size.toFixed(1))} ${units[unitIndex]}`;
}

export function formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '';
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    const remainingSeconds = String(total % 60).padStart(2, '0');
    if (minutes < 60) return `${minutes}:${remainingSeconds}`;
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${remainingSeconds}`;
}

export function formatAddress(value: string, maxLength = 60): string {
    return truncateText(value.trim().replace(/\s+/g, ' '), maxLength);
}

export function formatRelativeTime(value: Date | number | string, now = Date.now()): string {
    const date = parseDate(value);
    if (!date) return '';
    const elapsedSeconds = Math.round((date.getTime() - now) / 1000);
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
        ['year', 31536000], ['month', 2592000], ['week', 604800],
        ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1],
    ];
    const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const [unit, secondsPerUnit] = units.find(([, seconds]) => Math.abs(elapsedSeconds) >= seconds) ?? units[units.length - 1];
    return formatter.format(Math.round(elapsedSeconds / secondsPerUnit), unit);
}
