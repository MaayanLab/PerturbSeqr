import http from "http"
import postgraphile from "@/lib/postgraphile"

http
  .createServer(postgraphile)
  .listen(Number(process.env.GRAPHQL_PORT || 3000), '0.0.0.0', () => {
    console.log(`listening on port ${process.env.GRAPHQL_PORT || 3000}`)
  })
