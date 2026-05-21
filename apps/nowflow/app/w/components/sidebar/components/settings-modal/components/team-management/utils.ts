// Generate a slug from organization name
export function generateSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-')
}
