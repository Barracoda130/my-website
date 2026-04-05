# TODO

## Next Steps

- [x] Implement first feature module: expense tracker
  - [x] Create a Django app for expense tracking in `backend/`
  - [x] Add API endpoints and serializer/model validation
  - [x] Build matching frontend screens in `frontend/`
  - [x] Add backend, frontend, and auth/permission tests for the feature

- [ ] Add CI quality gates
  - [ ] Run backend test suite
  - [ ] Run frontend test suite
  - [ ] Regenerate OpenAPI schema
  - [ ] Regenerate typed client
  - [ ] Fail CI on schema/client drift

- [ ] Add Railway deployment configuration and smoke tests
  - [ ] Configure backend service deploy settings
  - [ ] Configure frontend service deploy settings
  - [ ] Validate environment variables in Railway
  - [ ] Run first deployment smoke tests end-to-end
