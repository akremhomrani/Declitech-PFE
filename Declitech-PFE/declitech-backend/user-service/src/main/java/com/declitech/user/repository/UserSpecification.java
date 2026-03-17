package com.declitech.user.repository;

import com.declitech.user.dto.UserFilterRequest;
import com.declitech.user.model.User;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

public class UserSpecification {

    public static Specification<User> filterBy(UserFilterRequest filter) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (filter.getFirstName() != null && !filter.getFirstName().trim().isEmpty()) {
                predicates.add(criteriaBuilder.like(
                    criteriaBuilder.lower(root.get("firstName")),
                    "%" + filter.getFirstName().toLowerCase().trim() + "%"
                ));
            }

            if (filter.getLastName() != null && !filter.getLastName().trim().isEmpty()) {
                predicates.add(criteriaBuilder.like(
                    criteriaBuilder.lower(root.get("lastName")),
                    "%" + filter.getLastName().toLowerCase().trim() + "%"
                ));
            }

            if (filter.getUsername() != null && !filter.getUsername().trim().isEmpty()) {
                predicates.add(criteriaBuilder.like(
                    criteriaBuilder.lower(root.get("username")),
                    "%" + filter.getUsername().toLowerCase().trim() + "%"
                ));
            }

            if (filter.getEmail() != null && !filter.getEmail().trim().isEmpty()) {
                predicates.add(criteriaBuilder.like(
                    criteriaBuilder.lower(root.get("email")),
                    "%" + filter.getEmail().toLowerCase().trim() + "%"
                ));
            }

            if (filter.getPhoneNumber() != null && !filter.getPhoneNumber().trim().isEmpty()) {
                predicates.add(criteriaBuilder.like(
                    root.get("phoneNumber"),
                    "%" + filter.getPhoneNumber().trim() + "%"
                ));
            }

            if (filter.getSexe() != null) {
                predicates.add(criteriaBuilder.equal(root.get("sexe"), filter.getSexe()));
            }

            if (filter.getRole() != null) {
                predicates.add(criteriaBuilder.equal(root.get("role"), filter.getRole()));
            }

            if (filter.getActive() != null) {
                predicates.add(criteriaBuilder.equal(root.get("active"), filter.getActive()));
            }

            if (filter.getSearch() != null && !filter.getSearch().trim().isEmpty()) {
                String searchPattern = "%" + filter.getSearch().toLowerCase().trim() + "%";
                Predicate firstNameMatch = criteriaBuilder.like(
                    criteriaBuilder.lower(root.get("firstName")), searchPattern);
                Predicate lastNameMatch = criteriaBuilder.like(
                    criteriaBuilder.lower(root.get("lastName")), searchPattern);
                Predicate usernameMatch = criteriaBuilder.like(
                    criteriaBuilder.lower(root.get("username")), searchPattern);
                Predicate emailMatch = criteriaBuilder.like(
                    criteriaBuilder.lower(root.get("email")), searchPattern);
                Predicate phoneMatch = criteriaBuilder.like(
                    root.get("phoneNumber"), searchPattern);

                predicates.add(criteriaBuilder.or(
                    firstNameMatch, lastNameMatch, usernameMatch, emailMatch, phoneMatch
                ));
            }

            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }
}
