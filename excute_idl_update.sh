# # remove the already existing file

rm -rf ./app/lib/idl/vault_inheritance.json
rm -rf ./app/lib/idl/vault_inheritance.ts

cp ./target/idl/vault_inheritance.json ./app/lib/idl/vault_inheritance.json
cp ./target/types/vault_inheritance.ts ./app/lib/idl/vault_inheritance.ts


# solana airdrop 100 9ZKnNkvLKqqnR36TV2AA3ysxED2khSUYb1BHFP1ozcMA --url http://127.0.0.1:8899 
# spl-token create-token --decimals 6 --url http://127.0.0.1:8899
# spl-token mint 2quHXSzWnysHqAkaetgXiwHN9Hiax1UFydNoczUoxhfs 1000000 D6z9v7B6cp7n1W5HNcNVye4Fws6Xk521ua4CfTBsNsxE --url http://127.0.0.1:8899

# spl-token transfer 2quHXSzWnysHqAkaetgXiwHN9Hiax1UFydNoczUoxhfs 1000000 9ZKnNkvLKqqnR36TV2AA3ysxED2khSUYb1BHFP1ozcMA --fund-recipient --url http://127.0.0.1:8899