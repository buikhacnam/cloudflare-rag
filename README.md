
## Vectorize

create a vector database

```shell
npx wrangler vectorize create my_vector --preset @cf/baai/bge-small-en-v1.5
```

update the vectorize binding in `wrangler.toml`

## D1

create D1 database

```bash
npx wrangler d1 create my_d1
```

update the D1 binding in `wrangler.toml`

Run the initial D1 migration

```shell
npx wrangler d1 migrations apply my_d1 --local
```

### Next Migration

after you modify the `prisma/schema.prisma` file, you can create a new migration using:

```shell
npx wrangler d1 migrations create my_d1 remove-salt-field
```

generate SQL statements using prisma migrate diff

```shell
npx prisma migrate diff \
  --from-local-d1 \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script \
  --output migrations/0002_remove-salt-field.sql
```

apply the migration to D1

```shell
npx wrangler d1 migrations apply my_d1 --local
```

generate Prisma client

```shell
npx prisma generate
```

### Deploy to Cloudflare

```shell
npx wrangler d1 migrations apply my_d1 --remote
```


## Add A Note

```shell
curl --location 'http://localhost:8787/api/v1/b8c741fd-bf11-4a79-b2e7-672e90ed2225/rag/add-note' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIyMzYxMGQ2ZS01M2U2LTQ0YzgtODkzYS1mNjRhOGMyZDU1MTQiLCJ3b3Jrc3BhY2VzIjp7ImI4Yzc0MWZkLWJmMTEtNGE3OS1iMmU3LTY3MmU5MGVkMjIyNSI6Ik9XTkVSIn0sImp0aSI6IjgwMmU5MmMzLWRhOWEtNDg2My04YTBiLWM5NjI4ZGM2M2VkYyIsImlhdCI6MTc0NTk0MjMyNywiZXhwIjoxNzQ1OTQ5NTI3LCJzdWIiOiIyMzYxMGQ2ZS01M2U2LTQ0YzgtODkzYS1mNjRhOGMyZDU1MTQiLCJpc3MiOiJjbG91ZGZsYXJlLWQxLWFwcCIsImF1ZCI6ImNsb3VkZmxhcmUtZDEtdXNlcnMifQ.NuUVe3BfrLxim_RLLo83dfDl5JvjWRL1V7_R0QhtRrs' \
--data '{
    "title": "Introduction to Artificial",
    "content": "Intelligence Ethics Artificial Intelligence (AI) ethics is a field of study that examines the moral implications of AI systems and their impact on society. As AI technologies become more sophisticated and integrated into our daily lives, understanding and addressing ethical concerns has become increasingly important. Key Ethical Challenges in AI 1. Bias and Fairness: AI systems can perpetuate and amplify existing biases in training data. This can lead to discriminatory outcomes in areas like hiring, lending, and criminal justice. Ensuring fairness requires careful data selection, algorithm design, and ongoing monitoring. 2. Privacy and Surveillance: AI-powered surveillance technologies raise concerns about individual privacy and civil liberties. The ability to track, analyze, and predict behavior can be used for both beneficial purposes and harmful surveillance. 3. Transparency and Explainability: Many AI systems operate as `black boxes` making decisions without clear explanations. This lack of transparency can make it difficult to understand, challenge, or improve AI decisions, especially in critical applications. 4. Accountability: Determining who is responsible for AI system outcomes—developers, users, or the systems themselves—presents complex legal and ethical challenges. 5. Job Displacement: Automation through AI has the potential to displace workers in various industries, raising concerns about economic inequality and the need for workforce transition programs. Ethical Frameworks for AI Development Utilitarian Approach: Focuses on maximizing overall benefits while minimizing harms. This framework would evaluate AI systems based on their net impact on society. Rights-Based Approach: Emphasizes protecting individual rights and dignity. This framework would prioritize privacy, autonomy, and non-discrimination in AI development. Virtue Ethics: Considers the character and intentions of those developing and deploying AI. This framework emphasizes honesty, transparency, and responsibility. Common Principles in AI Ethics 1. Beneficence: AI systems should be designed to benefit humanity and enhance human well-being. 2. Non-maleficence: AI systems should avoid causing harm to humans or the environment. 3. Autonomy: AI systems should respect human autonomy and decision-making. 4. Justice: AI systems should promote fairness and avoid discrimination. 5. Transparency: AI systems should be transparent in their operations and decision-making processes. Best Practices for Ethical AI Implementation 1. Establish clear ethical guidelines for AI development and deployment 2. Implement diverse and representative teams to identify potential biases 3. Conduct regular audits of AI systems for fairness and accuracy 4. Provide clear mechanisms for human oversight and intervention 5. Develop explainable AI systems where possible 6. Consider the broader societal impacts of AI applications Conclusion As AI technologies continue to advance, ethical considerations must remain at the forefront of development and deployment. By adhering to ethical principles and implementing best practices, we can harness the power of AI to benefit society while minimizing potential harms. The field of AI ethics will continue to evolve as new challenges emerge, requiring ongoing dialogue and adaptation of ethical frameworks.",
    "maxTokens": 1024
}'
```

## Query A Note
```shell
curl --location 'http://localhost:8787/playground/chat' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIyMzYxMGQ2ZS01M2U2LTQ0YzgtODkzYS1mNjRhOGMyZDU1MTQiLCJ3b3Jrc3BhY2VzIjp7ImI4Yzc0MWZkLWJmMTEtNGE3OS1iMmU3LTY3MmU5MGVkMjIyNSI6Ik9XTkVSIn0sImp0aSI6IjJmMDdiYWVmLTkxYjctNGNlOS04ZDg2LTAxZDYzNWNjNjcwYyIsImlhdCI6MTc0NTkzNjEwNiwiZXhwIjoxNzQ1OTQzMzA2LCJzdWIiOiIyMzYxMGQ2ZS01M2U2LTQ0YzgtODkzYS1mNjRhOGMyZDU1MTQiLCJpc3MiOiJjbG91ZGZsYXJlLWQxLWFwcCIsImF1ZCI6ImNsb3VkZmxhcmUtZDEtdXNlcnMifQ.squAec3rPqU9LvYBKecSCuiV0SG1FXNwPXYJFBOLeZw' \
--data '{
    "message": "what is the term black boxes?",
    "workspaceId": "b8c741fd-bf11-4a79-b2e7-672e90ed2225"
}'
```

Or through the chat widget playground by visiting:

http://localhost:8787/playground/widget/chat/

