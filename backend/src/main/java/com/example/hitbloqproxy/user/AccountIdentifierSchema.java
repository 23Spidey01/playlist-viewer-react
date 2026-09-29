package com.example.hitbloqproxy.user;

import javax.sql.DataSource;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.annotation.DependsOn;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Install identifier constraints after Hibernate creates/updates the schema, before startup completes. */
@Component
@DependsOn("entityManagerFactory")
public class AccountIdentifierSchema implements InitializingBean {
    private final JdbcTemplate jdbc;
    private final DataSource dataSource;

    public AccountIdentifierSchema(JdbcTemplate jdbc, DataSource dataSource) {
        this.jdbc = jdbc;
        this.dataSource = dataSource;
    }

    @Override
    public void afterPropertiesSet() throws Exception {
        Long conflicts = jdbc.queryForObject("""
                select count(*) from (
                    select identifier from (
                        select id, lower(trim(username)) as identifier from users
                        union all
                        select id, lower(trim(email)) as identifier from users where email is not null
                    ) identifiers group by identifier having count(distinct id) > 1
                ) conflicts
                """, Long.class);
        if (conflicts != null && conflicts > 0) {
            throw new IllegalStateException("Conflicting account identifiers exist. Resolve them before startup; see backend/README.md.");
        }
        String database;
        try (var connection = dataSource.getConnection()) {
            database = connection.getMetaData().getDatabaseProductName();
        }
        if ("PostgreSQL".equals(database)) {
            jdbc.execute("create unique index if not exists uk_users_username_ci on users (lower(trim(username)))");
            jdbc.execute("create unique index if not exists uk_users_email_ci on users (lower(trim(email)))");
        } else if ("H2".equals(database)) {
            // H2 has no expression indexes; equivalent generated columns support isolated integration tests.
            jdbc.execute("alter table users add column if not exists username_ci varchar(320) generated always as (lower(trim(username)))");
            jdbc.execute("alter table users add column if not exists email_ci varchar(320) generated always as (lower(trim(email)))");
            jdbc.execute("create unique index if not exists uk_users_username_ci on users (username_ci)");
            jdbc.execute("create unique index if not exists uk_users_email_ci on users (email_ci)");
        } else {
            throw new IllegalStateException("Account identifier constraints require PostgreSQL or H2");
        }
    }
}
