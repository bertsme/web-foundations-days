# Library Books API Design

Base URL: `https://api.example.com/v1`

The API exposes a `books` resource. Requests and responses use JSON, and book IDs are unique.

## Endpoints

### List books

- **Method:** `GET`
- **Path:** `/books`
- **Description:** Return the collection of books.
- **Success:** `200 OK`

### Get one book

- **Method:** `GET`
- **Path:** `/books/{bookId}`
- **Description:** Return the book with the requested ID.
- **Success:** `200 OK`

### Create a book

- **Method:** `POST`
- **Path:** `/books`
- **Description:** Create a book and return the saved resource.
- **Example request body:**

  ```json
  {
    "title": "The River Between",
    "author": "Ngũgĩ wa Thiong'o",
    "publishedYear": 1965,
    "isbn": "9780435905484"
  }
  ```

- **Success:** `201 Created`

### Replace a book

- **Method:** `PUT`
- **Path:** `/books/{bookId}`
- **Description:** Replace all editable fields of a book.
- **Example request body:**

  ```json
  {
    "title": "The River Between",
    "author": "Ngũgĩ wa Thiong'o",
    "publishedYear": 1965,
    "isbn": "9780435905484"
  }
  ```

- **Success:** `200 OK`

### Update book fields

- **Method:** `PATCH`
- **Path:** `/books/{bookId}`
- **Description:** Change only the supplied fields of a book.
- **Example request body:**

  ```json
  {
    "available": false
  }
  ```

- **Success:** `200 OK`

### Delete a book

- **Method:** `DELETE`
- **Path:** `/books/{bookId}`
- **Description:** Remove a book from the collection.
- **Success:** `204 No Content`

### List books by author

- **Method:** `GET`
- **Path:** `/books?author=Ng%C5%A9g%C4%A9%20wa%20Thiong%27o`
- **Description:** Return books whose author matches the `author` query parameter.
- **Success:** `200 OK`

## Error responses

- **`400 Bad Request`** — the request body is invalid, such as a create request with a missing title.
- **`404 Not Found`** — the requested book ID does not exist, such as `GET /books/9999`.
