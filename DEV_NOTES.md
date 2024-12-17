### Build image
```bash
docker image build --tag local-enstore --target release .
```

### Debug image
```bash
docker run --name local-enstore --rm -it -p 3000:3000 --entrypoint /bin/bash local-enstore
```

### Run image
```bash
docker run --name local-enstore --rm -p 3000:3000 local-enstore
```
