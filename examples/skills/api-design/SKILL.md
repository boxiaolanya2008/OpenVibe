---
name: api-design
description: RESTful API design guidelines and conventions. Use when designing new APIs or reviewing API implementations.
---

# API Design Skill

Guidelines for designing clean, consistent, and developer-friendly RESTful APIs.

## Design Principles

### 1. Resource-Oriented Design
- Use nouns for resource names: `/users`, `/orders`, `/products`
- Use HTTP methods to express actions:
  - `GET` - Retrieve resources
  - `POST` - Create new resources
  - `PUT` - Update entire resources
  - `PATCH` - Partial updates
  - `DELETE` - Remove resources

### 2. Consistent Naming
- Use kebab-case for URLs: `/user-profiles`
- Use camelCase for JSON fields: `firstName`
- Use plural nouns for collections: `/users`
- Avoid nested resources deeper than 2 levels

### 3. Versioning
- Include version in URL: `/api/v1/users`
- Or use header: `Accept: application/vnd.api+json;version=1`

## Request/Response Patterns

### Standard Response Format
```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

## HTTP Status Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 422 | Unprocessable Entity | Validation error |
| 500 | Internal Server Error | Server-side error |

## Pagination
- Use `page` and `limit` query parameters
- Include total count in response
- Provide next/previous links

## Filtering & Sorting
- `?status=active` - Filter by field
- `?sort=-createdAt` - Sort descending
- `?sort=createdAt,name` - Multiple sort fields
