import { Role, Section } from "../types";

const ROLE_PATTERNS: Record<Role, RegExp[]> = {
    user: [
        /user|người dùng|khách hàng|customer|client/i,
        /login|đăng nhập|register|đăng ký/i,
    ],
    admin: [
        /admin|administrator|quản trị|quản lý/i,
        /manage|management|dashboard/i,
    ],
    system: [
        /system|hệ thống|server|backend/i,
        /api|endpoint|service/i,
    ],
    guest: [
        /guest|khách|visitor|anonymous/i,
    ],
    manager: [
        /manager|quản lý|supervisor|giám sát/i,
    ],
    developer: [
        /developer|dev|programmer|lập trình viên/i,
        /code|implementation|codebase/i,
    ],
    unknown: [],
};

export function tagRoles(sections: Section[]): { sections: Section[]; roles: Role[] } {
    const roleCounts = new Map<Role, number>();
    const taggedSections: Section[] = [];

    for (const section of sections) {
        const sectionRoles: Role[] = [];
        const content = `${section.heading || ""} ${section.content}`.toLowerCase();

        for (const [role, patterns] of Object.entries(ROLE_PATTERNS)) {
            if (role === "unknown") continue;

            const matches = patterns.filter((pattern) => pattern.test(content)).length;
            if (matches > 0) {
                sectionRoles.push(role as Role);
                roleCounts.set(role as Role, (roleCounts.get(role as Role) || 0) + matches);
            }
        }

        taggedSections.push({
            ...section,
            roles: sectionRoles.length > 0 ? sectionRoles : ["unknown"],
        });
    }

    const topRoles = Array.from(roleCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([role]) => role);

    return {
        sections: taggedSections,
        roles: topRoles.length > 0 ? topRoles : ["unknown"],
    };
}

